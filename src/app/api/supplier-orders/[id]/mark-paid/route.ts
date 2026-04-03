import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendTelegramMessage, sendTelegramDocument } from '@/lib/telegram'
import { generateBdcPDF } from '@/lib/pdf/generate-bdc-pdf'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // 1. Auth check: admin/gerant only
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = (user.user_metadata?.role as string) ?? 'client'
    if (role !== 'admin' && role !== 'gerant') {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const serviceClient = createServiceRoleClient()

    // 2. Fetch supplier_order
    const { data: supplierOrder, error: fetchError } = await serviceClient
      .from('supplier_orders')
      .select('id, bdc_number, status, supplier_id, order_id')
      .eq('id', id)
      .single()

    if (fetchError || !supplierOrder) {
      return Response.json({ error: 'Commande fournisseur introuvable' }, { status: 404 })
    }

    // 3. Verify status is 'awaiting_payment'
    if (supplierOrder.status !== 'awaiting_payment') {
      return Response.json(
        { error: 'La commande fournisseur n\'est pas en attente de paiement' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // 4. Update status to 'sent', set paid_at and sent_at
    const { error: updateError } = await serviceClient
      .from('supplier_orders')
      .update({ status: 'sent', paid_at: now, sent_at: now })
      .eq('id', id)

    if (updateError) {
      console.error('mark-paid update error:', updateError)
      return Response.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    // 5. Fetch supplier data
    const { data: supplier, error: supplierError } = await serviceClient
      .from('suppliers')
      .select('id, name, email, address, postal_code, city, siret, contact_name')
      .eq('id', supplierOrder.supplier_id)
      .single()

    if (supplierError || !supplier) {
      console.error('Supplier fetch error after mark-paid:', supplierError)
      return Response.json({ success: true })
    }

    // 6. Fetch supplier_order_items for BDC PDF
    const { data: orderItems, error: itemsError } = await serviceClient
      .from('supplier_order_items')
      .select('product_name, variant_label, quantity, unit_price')
      .eq('supplier_order_id', id)

    if (itemsError || !orderItems || orderItems.length === 0) {
      console.error('supplier_order_items fetch error:', itemsError)
      // Non-blocking: proceed without PDF
      sendTelegramMessage(
        `✅ Paiement confirmé! BDC ${supplierOrder.bdc_number} envoyé à ${supplier.name}`
      ).catch(() => {})
      return Response.json({ success: true })
    }

    // 7. Build BDC PDF data structure
    const totalHT = orderItems.reduce(
      (sum: number, item: { unit_price: number; quantity: number }) =>
        sum + item.unit_price * item.quantity,
      0
    )

    const bdcData = {
      bdcNumber: supplierOrder.bdc_number,
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
      items: orderItems.map((item: {
        product_name: string
        variant_label?: string | null
        quantity: number
        unit_price: number
      }) => ({
        reference: '',
        name: item.product_name,
        variantLabel: item.variant_label ?? undefined,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })),
      totalHT,
    }

    // 8. Generate BDC PDF
    let pdfBuffer: Buffer | null = null
    try {
      pdfBuffer = generateBdcPDF(bdcData)
    } catch (pdfError) {
      console.error('BDC PDF generation failed:', pdfError)
    }

    const filename = `BDC-${supplierOrder.bdc_number}.pdf`

    // 9. Send BDC by email to supplier (non-blocking)
    if (pdfBuffer && supplier.email && process.env.RESEND_API_KEY) {
      resend.emails.send({
        from: 'noreply@opti-pro.fr',
        to: supplier.email,
        subject: `Bon de commande SAPAL — ${supplierOrder.bdc_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a365d;">Bon de commande SAPAL Signalisation</h2>
            <p>Bonjour,</p>
            <p>
              Veuillez trouver en pièce jointe le bon de commande
              <strong>${supplierOrder.bdc_number}</strong> de SAPAL Signalisation.
            </p>
            <p>
              Le paiement a été effectué. Merci de traiter cette commande dans les meilleurs délais.
            </p>
            <p style="color: #666; font-size: 14px;">
              Pour toute question : <a href="mailto:societe@sapal.fr">societe@sapal.fr</a>
            </p>
            <p style="color: #666; font-size: 14px;">L'équipe SAPAL Signalisation</p>
          </div>
        `,
        attachments: [
          {
            filename,
            content: pdfBuffer,
          },
        ],
      }).catch((err) => {
        console.error('Failed to send BDC email to supplier:', err)
      })
    }

    // 10. Send BDC via Telegram to SAPAL (non-blocking)
    if (pdfBuffer) {
      sendTelegramDocument(
        pdfBuffer,
        filename,
        `BDC ${supplierOrder.bdc_number} — ${supplier.name}`
      ).catch(() => {})
    }

    // 11. Send Telegram text confirmation
    sendTelegramMessage(
      `✅ Paiement confirmé! BDC ${supplierOrder.bdc_number} envoyé à ${supplier.name}`
    ).catch(() => {})

    return Response.json({ success: true })
  } catch (error) {
    console.error('API Error [mark-paid]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
