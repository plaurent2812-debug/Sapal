import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendTelegramMessage, sendTelegramDocument } from '@/lib/telegram'
import { generateBdcPDF } from '@/lib/pdf/generate-bdc-pdf'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  try {
    // 1. Auth check
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const serviceClient = createServiceRoleClient()

    // 2. Parse multipart form data
    const formData = await request.formData()
    const bcFile = formData.get('bc_file') as File | null
    const deliveryAddress = formData.get('delivery_address') as string | null
    const deliveryPostalCode = formData.get('delivery_postal_code') as string | null
    const deliveryCity = formData.get('delivery_city') as string | null

    if (!bcFile) {
      return Response.json({ error: 'Le fichier du bon de commande est requis' }, { status: 400 })
    }

    if (!deliveryAddress || !deliveryPostalCode || !deliveryCity) {
      return Response.json({ error: 'L\'adresse de livraison est requise' }, { status: 400 })
    }

    // 3. Fetch order and verify ownership + status
    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .select('id, user_id, quote_id, order_number, status, total_ht')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return Response.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    if (order.user_id !== user.id) {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    if (order.status !== 'awaiting_bc') {
      return Response.json({ error: 'Cette commande n\'attend pas de bon de commande' }, { status: 400 })
    }

    // 4. Upload BC file to Supabase Storage
    const fileBuffer = Buffer.from(await bcFile.arrayBuffer())
    const fileExt = bcFile.name.split('.').pop() || 'pdf'
    const storagePath = `${user.id}/${orderId}/bc.${fileExt}`

    const { error: uploadError } = await serviceClient.storage
      .from('client-bdc')
      .upload(storagePath, fileBuffer, {
        contentType: bcFile.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('BC upload error:', uploadError)
      return Response.json({ error: 'Erreur lors de l\'upload du fichier' }, { status: 500 })
    }

    // Get signed URL (valid 10 years — effectively permanent for admin access)
    const { data: signedUrlData } = await serviceClient.storage
      .from('client-bdc')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10)

    const bcFileUrl = signedUrlData?.signedUrl || storagePath

    // 5. Update order: BC file, delivery address, status → processing
    const { error: updateError } = await serviceClient
      .from('orders')
      .update({
        bc_file_url: bcFileUrl,
        delivery_address: deliveryAddress,
        delivery_postal_code: deliveryPostalCode,
        delivery_city: deliveryCity,
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Order update error:', updateError)
      return Response.json({ error: 'Erreur lors de la mise à jour de la commande' }, { status: 500 })
    }

    // 6. Fetch order_items with product + supplier data
    const { data: orderItems, error: itemsError } = await serviceClient
      .from('order_items')
      .select('id, product_id, product_name, variant_label, quantity, unit_price, supplier_id')
      .eq('order_id', orderId)

    if (itemsError || !orderItems || orderItems.length === 0) {
      console.error('Order items fetch error:', itemsError)
      return Response.json({ error: 'Impossible de récupérer les articles' }, { status: 500 })
    }

    // 7. Group order items by supplier_id
    const supplierGroups = new Map<string, typeof orderItems>()
    for (const item of orderItems) {
      if (!item.supplier_id) continue
      const group = supplierGroups.get(item.supplier_id) ?? []
      group.push(item)
      supplierGroups.set(item.supplier_id, group)
    }

    let supplierOrderCount = 0
    const prepaymentPdfs: { supplierName: string; bdcNumber: string; pdfBuffer: Buffer }[] = []

    // 8. For each supplier group, create supplier_order + send BDC
    for (const [supplierId, items] of supplierGroups) {
      // a. Fetch supplier data
      const { data: supplier, error: supplierError } = await serviceClient
        .from('suppliers')
        .select('id, name, email, address, postal_code, city, siret, contact_name, payment_terms')
        .eq('id', supplierId)
        .single()

      if (supplierError || !supplier) {
        console.error(`Supplier fetch error for ${supplierId}:`, supplierError)
        continue
      }

      // b. Generate BDC number
      const { data: bdcNumber, error: bdcNumberError } = await serviceClient
        .rpc('generate_bdc_number')

      if (bdcNumberError || !bdcNumber) {
        console.error('generate_bdc_number RPC error:', bdcNumberError)
        continue
      }

      // c. Calculate group total
      const groupTotalHT = items.reduce(
        (sum: number, item: { unit_price: number; quantity: number }) =>
          sum + item.unit_price * item.quantity,
        0
      )

      // d. Determine status based on payment_terms
      const isPrePayment = supplier.payment_terms === 'prepayment'
      const supplierOrderStatus = isPrePayment ? 'proforma_sent' : 'sent'
      const sentAt = isPrePayment ? null : new Date().toISOString()

      // e. Insert supplier_order
      const { data: supplierOrder, error: supplierOrderError } = await serviceClient
        .from('supplier_orders')
        .insert({
          order_id: orderId,
          supplier_id: supplierId,
          bdc_number: bdcNumber,
          status: supplierOrderStatus,
          total_ht: groupTotalHT,
          payment_terms: supplier.payment_terms,
          sent_at: sentAt,
          proforma_sent_at: isPrePayment ? new Date().toISOString() : null,
        })
        .select('id')
        .single()

      if (supplierOrderError || !supplierOrder) {
        console.error(`Supplier order insert error for ${supplierId}:`, supplierOrderError)
        continue
      }

      // f. Insert supplier_order_items
      const supplierOrderItemsPayload = items.map((item: {
        id: string
        product_id: string
        product_name: string
        variant_label?: string | null
        quantity: number
        unit_price: number
      }) => ({
        supplier_order_id: supplierOrder.id,
        order_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        variant_label: item.variant_label ?? null,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))

      const { error: supplierOrderItemsError } = await serviceClient
        .from('supplier_order_items')
        .insert(supplierOrderItemsPayload)

      if (supplierOrderItemsError) {
        console.error(`Supplier order items insert error for ${supplierId}:`, supplierOrderItemsError)
      }

      supplierOrderCount++

      // g. BDC PDF generation + dispatch
      void (async () => {
        try {
          const { data: clientProfile } = await serviceClient
            .from('client_profiles')
            .select('company_name')
            .eq('user_id', user.id)
            .single()

          const bdcItems = items.map((item: {
            product_id: string
            product_name: string
            variant_label?: string | null
            quantity: number
            unit_price: number
          }) => ({
            reference: item.product_id,
            name: item.product_name,
            variantLabel: item.variant_label ?? undefined,
            quantity: item.quantity,
            unitPrice: item.unit_price,
          }))

          const pdfBuffer = generateBdcPDF({
            bdcNumber,
            date: new Date().toLocaleDateString('fr-FR'),
            supplier: {
              name: supplier.name,
              email: supplier.email ?? undefined,
              address: supplier.address ?? undefined,
              postalCode: supplier.postal_code ?? undefined,
              city: supplier.city ?? undefined,
              siret: supplier.siret ?? undefined,
              contactName: supplier.contact_name ?? undefined,
            },
            delivery: {
              address: deliveryAddress,
              postalCode: deliveryPostalCode,
              city: deliveryCity,
              contactName: clientProfile?.company_name ?? undefined,
            },
            items: bdcItems,
            totalHT: groupTotalHT,
          })

          if (isPrePayment) {
            // PRÉPAIEMENT : BDC généré mais PAS envoyé au fournisseur
            // Le BDC sera envoyé quand le gérant confirmera le paiement (mark-paid)
            // Stocker le PDF pour l'envoyer dans le résumé Telegram
            prepaymentPdfs.push({ supplierName: supplier.name, bdcNumber, pdfBuffer })

          } else {
            // 30j : envoyer le BDC directement au fournisseur
            const emailSent = supplier.email
              ? await (async () => {
                  try {
                    await resend.emails.send({
                      from: process.env.RESEND_FROM_EMAIL ?? 'SAPAL Signalisation <commandes@sapal.fr>',
                      to: supplier.email!,
                      subject: `Bon de commande ${bdcNumber} - SAPAL Signalisation`,
                      html: `
                        <p>Bonjour,</p>
                        <p>Veuillez trouver ci-joint notre bon de commande <strong>${bdcNumber}</strong>.</p>
                        <p>Merci de livrer directement à l'adresse suivante :</p>
                        <p><strong>${deliveryAddress}<br>${deliveryPostalCode} ${deliveryCity}</strong></p>
                        <p>Cordialement,<br>SAPAL Signalisation</p>
                      `,
                      attachments: [{
                        filename: `${bdcNumber}.pdf`,
                        content: pdfBuffer.toString('base64'),
                      }],
                    })
                    return true
                  } catch (emailErr) {
                    console.error(`BDC email send error for ${bdcNumber}:`, emailErr)
                    return false
                  }
                })()
              : false

            // Telegram avec le BDC
            sendTelegramDocument(
              pdfBuffer,
              `${bdcNumber}.pdf`,
              `📦 BDC ${bdcNumber} envoyé à ${supplier.name}` +
              (emailSent ? ' ✅' : supplier.email ? ' (⚠️ échec email)' : ' (pas d\'email fournisseur)')
            ).catch(() => {})
          }
        } catch (bdcErr) {
          console.error(`BDC generation/dispatch error for ${bdcNumber}:`, bdcErr)
        }
      })()
    }

    // 9. Check if all supplier_orders are 'sent' → upgrade order to 'ordered'
    const { data: allSupplierOrders } = await serviceClient
      .from('supplier_orders')
      .select('status')
      .eq('order_id', orderId)

    const allSent = allSupplierOrders && allSupplierOrders.length > 0 &&
      allSupplierOrders.every((so: { status: string }) => so.status === 'sent')

    if (allSent) {
      await serviceClient
        .from('orders')
        .update({ status: 'ordered', updated_at: new Date().toISOString() })
        .eq('id', orderId)
    }

    // 10. Notifications gérant — différenciées selon les fournisseurs
    const gerantEmail = process.env.SAPAL_GERANT_EMAIL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sapal-site.vercel.app'
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'SAPAL Signalisation <noreply@opti-pro.fr>'

    // Collecter les infos pour le résumé
    const sentSuppliers: string[] = []
    const prepaymentSuppliers: { name: string; amount: number; bdcNumber: string }[] = []

    for (const [sid, sitems] of supplierGroups) {
      const { data: sup } = await serviceClient.from('suppliers').select('name, payment_terms').eq('id', sid).single()
      if (!sup) continue
      const total = sitems.reduce((s: number, i: { unit_price: number; quantity: number }) => s + i.unit_price * i.quantity, 0)
      const { data: so } = await serviceClient.from('supplier_orders').select('bdc_number').eq('order_id', orderId).eq('supplier_id', sid).single()
      if (sup.payment_terms === 'prepayment') {
        prepaymentSuppliers.push({ name: sup.name, amount: total, bdcNumber: so?.bdc_number ?? '' })
      } else {
        sentSuppliers.push(sup.name)
      }
    }

    // Email gérant
    if (gerantEmail) {
      const sentHtml = sentSuppliers.length > 0
        ? `<p style="margin:8px 0 0">✅ <strong>BDC envoyé${sentSuppliers.length > 1 ? 's' : ''} au fournisseur :</strong> ${sentSuppliers.join(', ')}</p>`
        : ''
      const prepayHtml = prepaymentSuppliers.length > 0
        ? prepaymentSuppliers.map(p =>
            `<p style="margin:8px 0 0">💳 <strong>Prépaiement requis :</strong> ${p.name} — ${p.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT (BDC ${p.bdcNumber})</p>`
          ).join('')
        : ''

      resend.emails.send({
        from: fromAddress,
        to: gerantEmail,
        subject: prepaymentSuppliers.length > 0
          ? `BC reçu + prépaiement requis — ${order.order_number}`
          : `BC reçu — BDC envoyé — ${order.order_number}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:${prepaymentSuppliers.length > 0 ? '#ea580c' : '#16a34a'};color:white;padding:24px;border-radius:8px 8px 0 0">
              <h1 style="margin:0;font-size:20px">SAPAL Signalisation</h1>
              <p style="margin:4px 0 0;opacity:0.8;font-size:14px">${prepaymentSuppliers.length > 0 ? 'Action requise — Prépaiement fournisseur' : 'BC client reçu — BDC envoyé'}</p>
            </div>
            <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
              <p>Le bon de commande client a été déposé pour la commande <strong>${order.order_number}</strong>.</p>
              <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;font-size:14px">
                <p style="margin:0"><strong>Commande :</strong> ${order.order_number}</p>
                <p style="margin:8px 0 0"><strong>Livraison :</strong> ${deliveryAddress}, ${deliveryPostalCode} ${deliveryCity}</p>
                ${sentHtml}
                ${prepayHtml}
              </div>
              ${prepaymentSuppliers.length > 0 ? `
              <p>Merci d'effectuer le virement au fournisseur puis de confirmer le paiement.</p>
              <div style="text-align:center;margin:24px 0">
                <a href="${siteUrl}/gerant/prepaiements" style="background:#ea580c;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold">Voir les prépaiements</a>
              </div>
              ` : `
              <div style="text-align:center;margin:24px 0">
                <a href="${siteUrl}/gerant/commandes" style="background:#1e293b;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold">Voir dans mon espace Gérant</a>
              </div>
              `}
            </div>
          </div>
        `,
      }).catch((err) => console.error('Gérant BC email error:', err))
    }

    // 11. Telegram résumé
    const telegramLines = [
      `📋 *BC client reçu — ${order.order_number}*`,
      `📍 Livraison : ${deliveryAddress}, ${deliveryPostalCode} ${deliveryCity}`,
    ]
    if (sentSuppliers.length > 0) {
      telegramLines.push(`✅ BDC envoyé : ${sentSuppliers.join(', ')}`)
    }
    for (const p of prepaymentSuppliers) {
      telegramLines.push(`💳 Prépaiement requis : ${p.name} — ${p.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT`)
    }
    sendTelegramMessage(telegramLines.join('\n')).catch(() => {})

    // Envoyer les PDF des prépaiements via Telegram pour que le gérant puisse payer
    for (const pp of prepaymentPdfs) {
      sendTelegramDocument(
        pp.pdfBuffer,
        `${pp.bdcNumber}.pdf`,
        `📎 BDC ${pp.bdcNumber} — ${pp.supplierName} (à payer)`
      ).catch(() => {})
    }

    return Response.json({
      success: true,
      supplierOrdersCreated: supplierOrderCount,
    })
  } catch (error) {
    console.error('API Error [upload-bc]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
