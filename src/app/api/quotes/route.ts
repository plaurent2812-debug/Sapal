import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { generateQuotePDF } from '@/lib/pdf/generate-quote-pdf'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendTelegramMessage, sendTelegramDocument } from '@/lib/telegram'
import { Resend } from 'resend'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

const quoteSchema = z.object({
  entity: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  message: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().optional(),
    delai: z.string().optional(),
  })).min(1),
})

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!checkRateLimit(ip, 10, 60000)) {
    return Response.json({ error: 'Trop de requêtes, réessayez dans 1 minute' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = quoteSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { entity, contactName, email, phone, message, items } = parsed.data
    const quoteId = randomUUID()

    const supabase = createServiceRoleClient()
    const { error: quoteError } = await supabase
      .from('quotes')
      .insert({
        id: quoteId,
        entity,
        contact_name: contactName,
        email,
        phone,
        message: message || null,
        status: 'sent',
      })

    if (quoteError) {
      console.error('Supabase quote insertion error:', quoteError)
      return Response.json({ error: 'Erreur lors de l\'enregistrement du devis' }, { status: 500 })
    }

    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(
        items.map(i => ({
          quote_id: quoteId,
          product_id: i.productId,
          product_name: i.productName,
          quantity: i.quantity,
        }))
      )

    if (itemsError) {
      console.error('Supabase quote items insertion error:', itemsError)
      return Response.json({ error: `Erreur lors de l'enregistrement des articles: ${itemsError.message}` }, { status: 500 })
    }

    // Associer le devis au compte client connecté si disponible
    try {
      const supabaseAuth = await createServerSupabaseClient()
      const { data: { user } } = await supabaseAuth.auth.getUser()
      if (user && user.user_metadata?.role === 'client') {
        await supabase.from('quotes').update({ user_id: user.id }).eq('id', quoteId)
      }
    } catch {
      // Silently fail — les devis anonymes restent valides sans user_id
    }

    // Récupérer les références produits pour le PDF
    const productIds = items.map(i => i.productId)
    const { data: products } = await supabase
      .from('products')
      .select('id, reference')
      .in('id', productIds)
    const refMap = new Map((products ?? []).map((p: { id: string; reference: string }) => [p.id, p.reference || '']))

    // Générer le PDF
    const pdfData = {
      quoteId,
      date: new Date().toLocaleDateString('fr-FR'),
      entity,
      contactName,
      email,
      phone,
      items: items.map(i => ({
        reference: refMap.get(i.productId) || '',
        productName: i.productName,
        quantity: i.quantity,
        unitPriceHT: i.unitPrice || 0,
        delai: i.delai,
      })),
    }
    const doc = generateQuotePDF(pdfData)
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    // Notifications asynchrones (Non-Bloquant pour l'utilisateur)
    sendNotifications({ entity, contactName, email, phone, items, quoteId, pdfBuffer }).catch(e => {
      console.error('Failed to send notifications:', e)
    })

    return Response.json({ success: true, quoteId })
  } catch (error) {
    console.error('API Error:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function sendNotifications(params: {
  entity: string
  contactName: string
  email: string
  phone: string
  items: { productId: string; productName: string; quantity: number; unitPrice?: number; delai?: string }[]
  quoteId: string
  pdfBuffer: Buffer
}) {
  const shortRef = params.quoteId.replace(/-/g, '').slice(0, 8).toUpperCase()
  const totalHT = params.items.reduce((sum, i) => sum + (i.unitPrice || 0) * i.quantity, 0)

  const itemsList = params.items
    .map(i => {
      let line = `  - ${i.productName} x${i.quantity}`
      if (i.unitPrice && i.unitPrice > 0) {
        const subtotal = (i.unitPrice * i.quantity).toFixed(2)
        line += ` (${subtotal} € HT)`
      }
      if (i.delai) {
        line += ` — Délai: ${/^\d+$/.test(i.delai) ? `${i.delai} semaines` : i.delai}`
      }
      return line
    })
    .join('\n')

  // 1. Telegram
  const text = [
    `📋 *Nouvelle demande de devis*`,
    ``,
    `*Entité :* ${params.entity}`,
    `*Contact :* ${params.contactName}`,
    `*Email :* ${params.email}`,
    `*Tél :* ${params.phone}`,
    ``,
    `*Produits :*`,
    itemsList,
    ``,
    totalHT > 0 ? `💰 *Total estimé HT :* ${totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '',
    ``,
    `_Réf : ${params.quoteId}_`,
  ].filter(Boolean).join('\n')

  await sendTelegramMessage(text)
  await sendTelegramDocument(
    params.pdfBuffer,
    `devis-${shortRef}.pdf`,
    `📎 Devis ${shortRef} — ${params.entity}`
  )

  // 2. Email au client avec le devis PDF
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sapal-site.vercel.app'
  const fromAddress = process.env.RESEND_FROM_QUOTES_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? 'SAPAL Signalisation <devis@sapal.fr>'

  try {
    await resend.emails.send({
      from: fromAddress,
      to: params.email,
      subject: `Votre devis SAPAL — Réf. ${shortRef}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
          <div style="background:#1e293b;color:white;padding:24px;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:20px">SAPAL Signalisation</h1>
            <p style="margin:4px 0 0;opacity:0.7;font-size:14px">Votre devis</p>
          </div>
          <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <p>Bonjour ${params.contactName},</p>
            <p>Veuillez trouver ci-joint votre devis <strong>Réf. ${shortRef}</strong> établi par SAPAL Signalisation.</p>
            <p>Pour accepter ce devis et passer commande, connectez-vous à votre espace client :</p>
            <div style="text-align:center;margin:24px 0">
              <a href="${siteUrl}/mon-compte/devis" style="background:#1e293b;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold">Accéder à mon espace client</a>
            </div>
            <p style="color:#6b7280;font-size:13px">Pour toute question, contactez-nous à <a href="mailto:societe@sapal.fr">societe@sapal.fr</a> ou au 06 22 90 28 54.</p>
            <p>Cordialement,<br><strong>L'équipe SAPAL Signalisation</strong></p>
          </div>
        </div>
      `,
      attachments: [{
        filename: `devis-${shortRef}.pdf`,
        content: params.pdfBuffer.toString('base64'),
      }],
    })
  } catch (emailErr) {
    console.error('Failed to send client quote email:', emailErr)
  }

  // 3. Email au gérant SAPAL
  const gerantEmail = process.env.SAPAL_GERANT_EMAIL || 'societe@sapal.fr'

  const itemsHtml = params.items.map(i => {
    const price = i.unitPrice && i.unitPrice > 0 ? i.unitPrice : 0
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.productName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${price > 0 ? `${(price * i.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '-'}</td>
    </tr>`
  }).join('')

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'SAPAL Signalisation <ne-pas-repondre@sapal.fr>',
      to: gerantEmail,
      subject: `Nouvelle demande de devis — ${params.entity} (Réf. ${shortRef})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1e293b;color:white;padding:24px;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:20px">Nouvelle demande de devis</h1>
            <p style="margin:4px 0 0;opacity:0.7;font-size:14px">Réf. ${shortRef}</p>
          </div>
          <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <h3 style="margin:0 0 16px;font-size:16px">Coordonnées client</h3>
            <table style="width:100%;font-size:14px;margin-bottom:20px">
              <tr><td style="padding:4px 0;color:#6b7280;width:120px">Entreprise</td><td style="padding:4px 0;font-weight:bold">${params.entity}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">Contact</td><td style="padding:4px 0">${params.contactName}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">Email</td><td style="padding:4px 0"><a href="mailto:${params.email}">${params.email}</a></td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">Téléphone</td><td style="padding:4px 0"><a href="tel:${params.phone}">${params.phone}</a></td></tr>
            </table>

            <h3 style="margin:0 0 12px;font-size:16px">Produits demandés</h3>
            <div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:20px">
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <thead>
                  <tr style="border-bottom:2px solid #e5e7eb">
                    <th style="padding:8px 12px;text-align:left">Produit</th>
                    <th style="padding:8px 12px;text-align:center">Qté</th>
                    <th style="padding:8px 12px;text-align:right">Total HT</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
              </table>
            </div>

            ${totalHT > 0 ? `
            <div style="background:#1e293b;color:white;border-radius:8px;padding:16px;margin-bottom:20px">
              <p style="margin:0;font-size:16px">Total estimé HT : <strong>${totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong></p>
            </div>
            ` : ''}

            <div style="text-align:center;margin:24px 0">
              <a href="${siteUrl}/admin/devis" style="background:#1e293b;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold">Voir le devis dans l'admin</a>
            </div>
          </div>
        </div>
      `,
      attachments: [{
        filename: `devis-${shortRef}.pdf`,
        content: params.pdfBuffer.toString('base64'),
      }],
    })
  } catch (emailErr) {
    console.error('Failed to send gerant email notification:', emailErr)
  }
}
