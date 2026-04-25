import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateBdcPDF } from '@/lib/pdf/generate-bdc-pdf'
import { getResendClient } from '@/lib/resend-client'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // 1. Auth — admin ou gérant
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'gerant') {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const serviceClient = createServiceRoleClient()

    // 2. Fetch supplier_order
    const { data: so, error: soError } = await serviceClient
      .from('supplier_orders')
      .select('id, bdc_number, status, supplier_id, order_id, total_ht')
      .eq('id', id)
      .single()

    if (soError || !so) {
      return Response.json({ error: 'Commande fournisseur introuvable' }, { status: 404 })
    }

    if (so.status !== 'proforma_sent') {
      return Response.json({ error: 'La proforma a déjà été demandée' }, { status: 400 })
    }

    // 3. Fetch supplier
    const { data: supplier } = await serviceClient
      .from('suppliers')
      .select('name, email, address, postal_code, city, siret, contact_name')
      .eq('id', so.supplier_id)
      .single()

    if (!supplier?.email) {
      return Response.json({ error: 'Le fournisseur n\'a pas d\'email configuré' }, { status: 400 })
    }

    // 4. Fetch parent order for delivery address
    const { data: order } = await serviceClient
      .from('orders')
      .select('delivery_address, delivery_postal_code, delivery_city, user_id')
      .eq('id', so.order_id)
      .single()

    let clientCompanyName: string | undefined
    if (order?.user_id) {
      const { data: profile } = await serviceClient
        .from('client_profiles')
        .select('company_name')
        .eq('user_id', order.user_id)
        .single()
      clientCompanyName = profile?.company_name ?? undefined
    }

    // 5. Fetch items
    const { data: items } = await serviceClient
      .from('supplier_order_items')
      .select('product_name, variant_label, quantity, unit_price')
      .eq('supplier_order_id', id)

    if (!items || items.length === 0) {
      return Response.json({ error: 'Aucun article trouvé' }, { status: 404 })
    }

    const totalHT = items.reduce(
      (sum: number, i: { unit_price: number; quantity: number }) => sum + i.unit_price * i.quantity,
      0
    )

    // 6. Generate BDC PDF
    const pdfBuffer = generateBdcPDF({
      bdcNumber: so.bdc_number,
      date: new Date().toLocaleDateString('fr-FR'),
      supplier: {
        name: supplier.name,
        email: supplier.email,
        address: supplier.address ?? undefined,
        postalCode: supplier.postal_code ?? undefined,
        city: supplier.city ?? undefined,
        siret: supplier.siret ?? undefined,
        contactName: supplier.contact_name ?? undefined,
      },
      delivery: order?.delivery_address ? {
        address: order.delivery_address,
        postalCode: order.delivery_postal_code ?? '',
        city: order.delivery_city ?? '',
        contactName: clientCompanyName,
      } : undefined,
      items: items.map((i: { product_name: string; variant_label?: string | null; quantity: number; unit_price: number }) => ({
        reference: '',
        name: i.product_name,
        variantLabel: i.variant_label ?? undefined,
        quantity: i.quantity,
        unitPrice: i.unit_price,
      })),
      totalHT,
    })

    // 7. Send email to supplier with BDC + proforma request
    const itemsTableRows = items.map((i: { product_name: string; variant_label?: string | null; quantity: number; unit_price: number }) =>
      `<tr>
        <td style="padding:6px;border:1px solid #ddd;">${i.product_name}${i.variant_label ? ` — ${i.variant_label}` : ''}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:center;">${i.quantity}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right;">${i.unit_price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
      </tr>`
    ).join('')
    const resend = getResendClient()

    if (!resend) {
      return Response.json({ error: 'Service email non configuré' }, { status: 500 })
    }

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'SAPAL Signalisation <commandes@sapal.fr>',
      to: supplier.email,
      subject: `Demande de proforma — BDC ${so.bdc_number} — SAPAL Signalisation`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <p>Bonjour,</p>
          <p>Nous souhaitons passer commande des articles ci-dessous (BDC <strong>${so.bdc_number}</strong> en pièce jointe).</p>
          <p>Pourriez-vous nous faire parvenir votre <strong>proforma / facture anticipée</strong> afin que nous puissions procéder au règlement ?</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:6px;border:1px solid #ddd;text-align:left;">Désignation</th>
                <th style="padding:6px;border:1px solid #ddd;text-align:center;">Qté</th>
                <th style="padding:6px;border:1px solid #ddd;text-align:right;">Prix unit. HT</th>
              </tr>
            </thead>
            <tbody>${itemsTableRows}</tbody>
          </table>
          <p><strong>Total HT : ${totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong></p>
          ${order?.delivery_address ? `
          <p>Adresse de livraison :</p>
          <p><strong>${order.delivery_address}<br>${order.delivery_postal_code ?? ''} ${order.delivery_city ?? ''}</strong></p>
          ` : ''}
          <p>Merci par avance pour votre retour rapide.</p>
          <p>Cordialement,<br>SAPAL Signalisation</p>
        </div>
      `,
      attachments: [{
        filename: `BDC-${so.bdc_number}.pdf`,
        content: pdfBuffer.toString('base64'),
      }],
    })

    // 8. Update status → awaiting_payment
    await serviceClient
      .from('supplier_orders')
      .update({ status: 'awaiting_payment', proforma_sent_at: new Date().toISOString() })
      .eq('id', id)

    return Response.json({ success: true })
  } catch (error) {
    console.error('API Error [request-proforma]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
