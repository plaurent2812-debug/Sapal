import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'
import {
  isPennylaneConfigured,
  createInvoice,
  getCustomerByEmail,
  createCustomer,
  getInvoicePDF,
} from '@/lib/pennylane'
import { getResendClient } from '@/lib/resend-client'

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

    // 2. Fetch order
    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .select('id, order_number, status, user_id, total_ht, total_ttc')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return Response.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    // 3. Verify order status allows marking as delivered
    const allowedStatuses = ['processing', 'ordered', 'shipped', 'partially_delivered']
    if (!allowedStatuses.includes(order.status)) {
      return Response.json(
        { error: 'La commande ne peut pas être marquée comme livrée dans son état actuel' },
        { status: 400 }
      )
    }

    // 4. Check that ALL supplier_orders for this order have status = 'delivered'
    const { data: supplierOrders, error: supplierOrdersError } = await serviceClient
      .from('supplier_orders')
      .select('id, status')
      .eq('order_id', id)

    if (supplierOrdersError) {
      console.error('supplier_orders fetch error:', supplierOrdersError)
      return Response.json({ error: 'Erreur lors de la vérification des commandes fournisseur' }, { status: 500 })
    }

    const allDelivered =
      supplierOrders &&
      supplierOrders.length > 0 &&
      supplierOrders.every((so: { status: string }) => so.status === 'delivered')

    if (!allDelivered) {
      return Response.json(
        { error: 'Toutes les commandes fournisseur doivent être livrées' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // 5. Update order status to 'delivered'
    const { error: deliveredUpdateError } = await serviceClient
      .from('orders')
      .update({ status: 'delivered', delivered_at: now })
      .eq('id', id)

    if (deliveredUpdateError) {
      console.error('order mark-delivered update error:', deliveredUpdateError)
      return Response.json({ error: 'Erreur lors de la mise à jour de la commande' }, { status: 500 })
    }

    // 6. Pennylane invoice creation (Phase 10)
    let invoiceUrl: string | null = null

    if (isPennylaneConfigured()) {
      try {
        // a. Get client user email from auth
        const { data: authUserData } = await serviceClient.auth.admin.getUserById(order.user_id)
        const clientEmail = authUserData?.user?.email ?? ''

        // b. Get or create customer in Pennylane
        let pennylaneCustomer = clientEmail ? await getCustomerByEmail(clientEmail) : null

        if (!pennylaneCustomer && clientEmail) {
          const { data: profile } = await serviceClient
            .from('client_profiles')
            .select('company_name, phone, address, postal_code, city, siret')
            .eq('user_id', order.user_id)
            .single()

          pennylaneCustomer = await createCustomer({
            name: profile?.company_name ?? clientEmail,
            email: clientEmail,
            phone: profile?.phone ?? undefined,
            address: profile?.address ?? undefined,
            postalCode: profile?.postal_code ?? undefined,
            city: profile?.city ?? undefined,
            siret: profile?.siret ?? undefined,
          })
        }

        if (pennylaneCustomer) {
          // c. Fetch order_items
          const { data: orderItems } = await serviceClient
            .from('order_items')
            .select('product_name, variant_label, quantity, unit_price')
            .eq('order_id', id)

          if (orderItems && orderItems.length > 0) {
            // d. Create invoice
            const today = new Date()
            const deadlineDate = new Date(today)
            deadlineDate.setDate(deadlineDate.getDate() + 30)

            const invoiceData = await createInvoice({
              customerSourceId: pennylaneCustomer.source_id ?? pennylaneCustomer.id,
              date: today.toISOString().split('T')[0],
              deadline: deadlineDate.toISOString().split('T')[0],
              items: orderItems.map((item: {
                product_name: string
                variant_label?: string | null
                quantity: number
                unit_price: number
              }) => ({
                label: item.variant_label
                  ? `${item.product_name} — ${item.variant_label}`
                  : item.product_name,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                vatRate: 0.2,
              })),
            })

            const pennylaneInvoiceId =
              invoiceData?.customer_invoice?.id ?? invoiceData?.id ?? null

            // e. Get invoice PDF URL
            if (pennylaneInvoiceId) {
              invoiceUrl = await getInvoicePDF(pennylaneInvoiceId)

              // f. Store pennylane_invoice_id and invoice_url on the order
              await serviceClient
                .from('orders')
                .update({
                  pennylane_invoice_id: pennylaneInvoiceId,
                  invoice_url: invoiceUrl,
                  status: 'invoiced',
                  invoiced_at: new Date().toISOString(),
                })
                .eq('id', id)
            }
          }
        }
      } catch (pennylaneError) {
        console.error('Pennylane invoice creation failed (non-blocking):', pennylaneError)
        // Fall through to local stub below
      }
    }

    // If Pennylane not configured OR failed without updating the order, mark as invoiced locally
    const { data: refreshedOrder } = await serviceClient
      .from('orders')
      .select('status, invoiced_at')
      .eq('id', id)
      .single()

    if (!refreshedOrder || refreshedOrder.status !== 'invoiced') {
      await serviceClient
        .from('orders')
        .update({ status: 'invoiced', invoiced_at: new Date().toISOString() })
        .eq('id', id)
    }

    // 7. Send email to client (non-blocking)
    const resend = getResendClient()
    if (order.user_id && resend) {
      try {
        const { data: authUserData } = await serviceClient.auth.admin.getUserById(order.user_id)
        const clientEmail = authUserData?.user?.email

        if (clientEmail) {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sapal.fr'

          resend.emails.send({
            from: 'noreply@opti-pro.fr',
            to: clientEmail,
            subject: `Votre facture SAPAL - Commande ${order.order_number}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a365d;">Votre commande a été livrée</h2>
                <p>Bonjour,</p>
                <p>
                  Votre commande <strong>${order.order_number}</strong> a été livrée.
                  Votre facture est disponible dans votre espace client.
                </p>
                ${invoiceUrl ? `
                  <p style="margin: 24px 0;">
                    <a
                      href="${invoiceUrl}"
                      style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;"
                    >
                      Télécharger la facture
                    </a>
                  </p>
                ` : `
                  <p style="margin: 24px 0;">
                    <a
                      href="${siteUrl}/espace-client/commandes"
                      style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;"
                    >
                      Accéder à mon espace client
                    </a>
                  </p>
                `}
                <p style="color: #666; font-size: 14px;">
                  Pour toute question : <a href="mailto:societe@sapal.fr">societe@sapal.fr</a>
                </p>
                <p style="color: #666; font-size: 14px;">L'équipe SAPAL Signalisation</p>
              </div>
            `,
          }).catch((err) => {
            console.error('Failed to send delivery/invoice email to client:', err)
          })
        }
      } catch (emailUserError) {
        console.error('Failed to fetch user for delivery email:', emailUserError)
      }
    }

    // 8. Send Telegram notification (non-blocking)
    sendTelegramMessage(
      `🎉 Commande ${order.order_number} livrée et facturée`
    ).catch(() => {})

    return Response.json({ success: true })
  } catch (error) {
    console.error('API Error [order mark-delivered]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
