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
      const supplierOrderStatus = isPrePayment ? 'awaiting_payment' : 'sent'
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

      // g. BDC PDF generation + dispatch (non-blocking)
      void (async () => {
        try {
          // Fetch client profile for delivery contact name
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
            // Do not send to supplier yet — notify SAPAL via Telegram only
            sendTelegramMessage(
              `⏳ *BDC en attente de paiement*\n\n` +
              `N° : ${bdcNumber}\n` +
              `Fournisseur : ${supplier.name}\n` +
              `Total HT : ${groupTotalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €\n` +
              `➡️ Le BDC sera envoyé au fournisseur après règlement.`
            ).catch(() => {})
          } else {
            // payment_terms === '30j' — send BDC to supplier
            const emailSent = supplier.email
              ? await (async () => {
                  try {
                    const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'SAPAL Signalisation <commandes@sapal-signaletique.fr>'
                    const emailHtml = `
                      <p>Bonjour,</p>
                      <p>Veuillez trouver ci-joint notre bon de commande <strong>${bdcNumber}</strong>.</p>
                      <p>Merci de livrer directement à l'adresse suivante :</p>
                      <p><strong>${deliveryAddress}<br>${deliveryPostalCode} ${deliveryCity}</strong></p>
                      <p>Cordialement,<br>SAPAL Signalisation</p>
                    `
                    await resend.emails.send({
                      from: fromAddress,
                      to: supplier.email!,
                      subject: `Bon de commande ${bdcNumber} - SAPAL Signalisation`,
                      html: emailHtml,
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

            // Send BDC PDF to SAPAL via Telegram
            sendTelegramDocument(
              pdfBuffer,
              `${bdcNumber}.pdf`,
              `📦 BDC ${bdcNumber} — ${supplier.name}` +
              (emailSent ? ' (email envoyé au fournisseur)' : supplier.email ? ' (⚠️ échec email fournisseur)' : ' (pas d\'email fournisseur)')
            ).catch(() => {})
          }
        } catch (bdcErr) {
          console.error(`BDC generation/dispatch error for ${bdcNumber}:`, bdcErr)
        }
      })()
    }

    // 9. Telegram summary notification (non-blocking)
    sendTelegramMessage(
      `📋 *BC client reçu — Commandes fournisseur créées*\n\n` +
      `📦 Commande : ${order.order_number}\n` +
      `🏭 Commande(s) fournisseur : ${supplierOrderCount}\n` +
      `📍 Livraison : ${deliveryAddress}, ${deliveryPostalCode} ${deliveryCity}`
    ).catch(() => {})

    return Response.json({
      success: true,
      supplierOrdersCreated: supplierOrderCount,
    })
  } catch (error) {
    console.error('API Error [upload-bc]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
