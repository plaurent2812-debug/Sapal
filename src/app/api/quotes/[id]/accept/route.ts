import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const TVA_RATE = 0.20

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // 1. Auth check
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const serviceClient = createServiceRoleClient()

    // 2. Fetch quote and verify ownership
    const { data: quote, error: quoteError } = await serviceClient
      .from('quotes')
      .select('id, user_id, email, status, entity, contact_name')
      .eq('id', id)
      .single()

    if (quoteError || !quote) {
      return Response.json({ error: 'Devis introuvable' }, { status: 404 })
    }

    const isOwner = quote.user_id === user.id || quote.email === user.email
    if (!isOwner) {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // 3. Verify quote status
    if (quote.status !== 'sent') {
      return Response.json({ error: 'Ce devis ne peut pas être accepté' }, { status: 400 })
    }

    // 4. Update quote status to accepted
    const { error: quoteUpdateError } = await serviceClient
      .from('quotes')
      .update({ status: 'accepted' })
      .eq('id', id)

    if (quoteUpdateError) {
      console.error('Quote accept update error:', quoteUpdateError)
      return Response.json({ error: 'Erreur lors de l\'acceptation du devis' }, { status: 500 })
    }

    // From here on, if anything fails we need to handle it gracefully.
    // The quote is already marked accepted — we log errors and return a partial success
    // rather than leaving the order in a broken state silently.
    try {
      // 5. Fetch quote_items with product data
      const { data: quoteItems, error: itemsError } = await serviceClient
        .from('quote_items')
        .select('*, products(price, supplier_id, name)')
        .eq('quote_id', id)

      if (itemsError || !quoteItems || quoteItems.length === 0) {
        console.error('Quote items fetch error:', itemsError)
        return Response.json(
          { error: 'Impossible de récupérer les articles du devis' },
          { status: 500 }
        )
      }

      // 6. Generate order number via RPC
      const { data: orderNumber, error: orderNumberError } = await serviceClient
        .rpc('generate_order_number')

      if (orderNumberError || !orderNumber) {
        console.error('generate_order_number RPC error:', orderNumberError)
        return Response.json({ error: 'Impossible de générer le numéro de commande' }, { status: 500 })
      }

      // 7. Calculate totals
      // unit_price on quote_items may be 0 (legacy) — fall back to products.price
      const totalHT = quoteItems.reduce((sum: number, item: { unit_price?: number; quantity: number; products?: { price?: number } | null }) => {
        const price = (item.unit_price && item.unit_price > 0)
          ? item.unit_price
          : (item.products?.price ?? 0)
        return sum + price * item.quantity
      }, 0)
      const totalTTC = totalHT * (1 + TVA_RATE)

      // 8. Insert order row
      const { data: order, error: orderError } = await serviceClient
        .from('orders')
        .insert({
          quote_id: id,
          user_id: user.id,
          order_number: orderNumber,
          status: 'awaiting_bc',
          total_ht: totalHT,
          total_ttc: totalTTC,
        })
        .select('id, order_number')
        .single()

      if (orderError || !order) {
        console.error('Order insert error:', orderError)
        return Response.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
      }

      // 9. Insert order_items rows
      const orderItemsPayload = quoteItems.map((item: {
        product_id: string
        product_name: string
        variant_id?: string | null
        variant_label?: string | null
        quantity: number
        unit_price?: number
        products?: { price?: number; supplier_id?: string | null } | null
      }) => {
        const unitPrice = (item.unit_price && item.unit_price > 0)
          ? item.unit_price
          : (item.products?.price ?? 0)
        return {
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          variant_id: item.variant_id ?? null,
          variant_label: item.variant_label ?? null,
          quantity: item.quantity,
          unit_price: unitPrice,
          supplier_id: item.products?.supplier_id ?? null,
        }
      })

      const { error: orderItemsError } = await serviceClient
        .from('order_items')
        .insert(orderItemsPayload)

      if (orderItemsError) {
        console.error('Order items insert error:', orderItemsError)
        return Response.json({ error: 'Erreur lors de l\'enregistrement des articles' }, { status: 500 })
      }

      // 10. Email de confirmation au client — demande de dépôt du bon de commande (non-blocking)
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sapal-site.vercel.app'
      const formattedTotal = totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })
      const formattedTTC = (totalHT * (1 + TVA_RATE)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })

      const itemsHtml = quoteItems.map((item: { product_name: string; quantity: number; unit_price?: number; products?: { price?: number } | null }) => {
        const price = (item.unit_price && item.unit_price > 0) ? item.unit_price : (item.products?.price ?? 0)
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${item.product_name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${(price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
        </tr>`
      }).join('')

      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'SAPAL Signalisation <ne-pas-repondre@sapal-signaletique.fr>',
        to: quote.email,
        subject: `Commande ${order.order_number} — Bon de commande requis`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1e293b;color:white;padding:24px;border-radius:8px 8px 0 0">
              <h1 style="margin:0;font-size:20px">SAPAL Signalisation</h1>
              <p style="margin:4px 0 0;opacity:0.7;font-size:14px">Confirmation de commande</p>
            </div>
            <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
              <p>Bonjour ${quote.contact_name},</p>
              <p>Votre commande <strong>${order.order_number}</strong> a bien été enregistrée suite à votre acceptation du devis.</p>

              <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:20px 0">
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

              <div style="background:#1e293b;color:white;border-radius:8px;padding:16px;margin:20px 0">
                <p style="margin:0;font-size:14px">Total HT : <strong>${formattedTotal} €</strong></p>
                <p style="margin:4px 0 0;font-size:14px">TVA (20%) : ${(totalHT * TVA_RATE).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                <p style="margin:4px 0 0;font-size:16px">Total TTC : <strong>${formattedTTC} €</strong></p>
              </div>

              <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:16px;margin:20px 0">
                <p style="margin:0;font-size:14px;color:#713f12"><strong>Action requise</strong></p>
                <p style="margin:8px 0 0;font-size:14px;color:#713f12">Pour finaliser votre commande, merci de :</p>
                <ol style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#713f12">
                  <li>Déposer votre <strong>bon de commande</strong> dans votre espace client</li>
                  <li>Confirmer votre <strong>adresse de livraison</strong></li>
                </ol>
              </div>

              <div style="text-align:center;margin:28px 0">
                <a href="${siteUrl}/mon-compte/commandes" style="background:#1e293b;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold">Accéder à mes commandes</a>
              </div>

              <p style="color:#6b7280;font-size:13px;margin-top:24px">Votre commande sera traitée dès réception de votre bon de commande. Pour toute question, n'hésitez pas à nous contacter.</p>

              <p>Cordialement,<br><strong>L'équipe SAPAL Signalisation</strong></p>
            </div>
          </div>
        `,
      }).catch((err) => console.error('Confirmation email error:', err))

      // 11. Telegram notification (non-blocking)
      const identifier = quote.entity || quote.contact_name || quote.email
      const shortId = id.replace(/-/g, '').slice(0, 8).toUpperCase()
      sendTelegramMessage(
        `✅ *Devis accepté — Commande en attente de BC*\n\n` +
        `📋 Devis : ${shortId}\n` +
        `🏢 Client : ${identifier}\n` +
        `📦 Commande : ${order.order_number}\n` +
        `💰 Total HT : ${formattedTotal} €\n` +
        `⏳ En attente du bon de commande client`
      ).catch(() => {})

      // 12. Return success
      return Response.json({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
      })
    } catch (orderCreationError) {
      // Quote is already accepted — log the error so it can be handled manually
      console.error('Order creation failed after quote acceptance:', orderCreationError)
      return Response.json(
        { error: 'Devis accepté mais erreur lors de la création de la commande. Contactez SAPAL.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('API Error [accept quote]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
