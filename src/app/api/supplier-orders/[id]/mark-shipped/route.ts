import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'

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

    // 3. Verify status is 'sent'
    if (supplierOrder.status !== 'sent') {
      return Response.json(
        { error: 'La commande fournisseur n\'est pas dans l\'état "envoyée"' },
        { status: 400 }
      )
    }

    // 4. Update status to 'shipped', set shipped_at
    const { error: updateError } = await serviceClient
      .from('supplier_orders')
      .update({ status: 'shipped', shipped_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      console.error('mark-shipped (supplier) update error:', updateError)
      return Response.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    // 5. Fetch supplier name for notification (non-blocking on failure)
    const { data: supplier } = await serviceClient
      .from('suppliers')
      .select('name')
      .eq('id', supplierOrder.supplier_id)
      .single()

    // 6. Check if ALL supplier_orders for the parent order are now 'shipped' or 'delivered'
    const { data: allSupplierOrders } = await serviceClient
      .from('supplier_orders')
      .select('status')
      .eq('order_id', supplierOrder.order_id)

    const allShippedOrDelivered = allSupplierOrders && allSupplierOrders.length > 0 &&
      allSupplierOrders.every((so: { status: string }) =>
        so.status === 'shipped' || so.status === 'delivered'
      )

    if (allShippedOrDelivered) {
      await serviceClient
        .from('orders')
        .update({ status: 'shipped', shipped_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', supplierOrder.order_id)
    }

    // 7. Send Telegram notification (non-blocking)
    sendTelegramMessage(
      `🚚 Expédition confirmée: BDC ${supplierOrder.bdc_number} de ${supplier?.name ?? supplierOrder.supplier_id}`
    ).catch(() => {})

    return Response.json({ success: true })
  } catch (error) {
    console.error('API Error [supplier-order mark-shipped]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
