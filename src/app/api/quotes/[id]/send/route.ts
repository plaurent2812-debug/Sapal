import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateQuotePDF, type QuotePDFItem } from '@/lib/pdf/generate-quote-pdf'
import { sendTelegramMessage, sendTelegramDocument } from '@/lib/telegram'
import { Resend } from 'resend'
import type { NextRequest } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  try {
    // Auth check: admin or gerant only
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const role = (user.user_metadata?.role as string) ?? 'client'
    if (role !== 'admin' && role !== 'gerant') {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const supabase = createServiceRoleClient()

    // Fetch quote with items
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('id', id)
      .single()

    if (quoteError || !quote) {
      return Response.json({ error: 'Devis introuvable' }, { status: 404 })
    }

    if (quote.status === 'sent') {
      return Response.json({ error: 'Ce devis a déjà été envoyé' }, { status: 400 })
    }

    // Fetch product prices and references for PDF
    const productIds = (quote.quote_items as { product_id: string }[]).map(
      (item) => item.product_id
    )

    const { data: products } = await supabase
      .from('products')
      .select('id, price, reference')
      .in('id', productIds)

    const productMap = new Map(
      (products ?? []).map((p: { id: string; price: number; reference: string }) => [
        p.id,
        { price: Number(p.price) || 0, reference: p.reference || '' },
      ])
    )

    // Build PDF items — prefer unit_price stored on quote_items if non-zero
    const pdfItems: QuotePDFItem[] = (
      quote.quote_items as {
        product_id: string
        product_name: string
        quantity: number
        unit_price?: number | null
      }[]
    ).map((item) => {
      const product = productMap.get(item.product_id)
      const unitPriceHT =
        item.unit_price && item.unit_price > 0
          ? item.unit_price
          : (product?.price ?? 0)
      return {
        reference: product?.reference ?? '',
        productName: item.product_name,
        quantity: item.quantity,
        unitPriceHT,
      }
    })

    const date = new Date(quote.created_at as string).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    const doc = generateQuotePDF({
      quoteId: quote.id as string,
      date,
      entity: quote.entity as string,
      contactName: quote.contact_name as string,
      email: quote.email as string,
      phone: quote.phone as string,
      items: pdfItems,
    })

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    const shortRef = (quote.id as string).replace(/-/g, '').slice(0, 8).toUpperCase()
    const clientEmail = quote.email as string
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sapal.fr'
    const fromAddress =
      process.env.RESEND_FROM_QUOTES_EMAIL ??
      process.env.RESEND_FROM_EMAIL ??
      'SAPAL Signalisation <devis@sapal.fr>'

    // Send email with PDF attachment
    const { error: emailError } = await resend.emails.send({
      from: fromAddress,
      to: clientEmail,
      subject: `Votre devis SAPAL — Réf. ${shortRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #1a1a1a;">Votre devis SAPAL Signalisation</h2>
          <p>Bonjour ${quote.contact_name ?? ''},</p>
          <p>
            Veuillez trouver ci-joint votre devis <strong>Réf. ${shortRef}</strong>
            établi par SAPAL Signalisation.
          </p>
          <p>
            Pour accepter ou refuser ce devis, connectez-vous à votre espace client :
          </p>
          <p style="margin: 24px 0;">
            <a
              href="${siteUrl}/mon-compte/devis"
              style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;"
            >
              Accéder à mon espace client
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Pour toute question, contactez-nous à
            <a href="mailto:societe@sapal.fr">societe@sapal.fr</a>
            ou au 04 93 39 30 30.
          </p>
          <p style="color: #666; font-size: 14px;">
            L'équipe SAPAL Signalisation
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `devis-${shortRef}.pdf`,
          content: pdfBuffer.toString('base64'),
        },
      ],
    })

    if (emailError) {
      console.error('Resend email error [send quote]:', emailError)
      return Response.json(
        { error: `Erreur lors de l'envoi de l'email : ${emailError.message}` },
        { status: 500 }
      )
    }

    // Update quote status to 'sent'
    const { error: updateError } = await supabase
      .from('quotes')
      .update({ status: 'sent' })
      .eq('id', id)

    if (updateError) {
      console.error('Quote status update error [send]:', updateError)
      // Email was already sent — log but don't fail
    }

    // Telegram notification (non-blocking)
    const totalHT = pdfItems.reduce(
      (sum, item) => sum + item.unitPriceHT * item.quantity,
      0
    )
    sendTelegramMessage(
      `📨 *Devis envoyé au client*\n\n` +
      `📋 Réf : ${shortRef}\n` +
      `🏢 ${quote.entity ?? ''}\n` +
      `📧 ${clientEmail}\n` +
      (totalHT > 0
        ? `💰 Total HT : ${totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €\n`
        : '') +
      `👤 Envoyé par : ${user.email}`
    ).catch(() => {})

    sendTelegramDocument(
      pdfBuffer,
      `devis-${shortRef}.pdf`,
      `📎 Devis ${shortRef} envoyé à ${clientEmail}`
    ).catch(() => {})

    return Response.json({ success: true })
  } catch (error) {
    console.error('API Error [send quote]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
