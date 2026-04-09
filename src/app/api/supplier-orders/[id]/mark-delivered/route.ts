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
      .select('id, bdc_number, status, supplier_id')
      .eq('id', id)
      .single()

    if (fetchError || !supplierOrder) {
      return Response.json({ error: 'Commande fournisseur introuvable' }, { status: 404 })
    }

    // 3. Verify status is 'sent' or 'shipped'
    if (supplierOrder.status !== 'sent' && supplierOrder.status !== 'shipped') {
      return Response.json(
        { error: 'La commande fournisseur doit être en statut "envoyée" ou "expédiée"' },
        { status: 400 }
      )
    }

    // 4. Update status to 'delivered', set delivered_at
    const { error: updateError } = await serviceClient
      .from('supplier_orders')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      console.error('mark-delivered (supplier) update error:', updateError)
      return Response.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    // 5. Fetch supplier name for notification (non-blocking on failure)
    const { data: supplier } = await serviceClient
      .from('suppliers')
      .select('name')
      .eq('id', supplierOrder.supplier_id)
      .single()

    // 6. Send Telegram notification (non-blocking)
    sendTelegramMessage(
      `📦 Livraison confirmée: BDC ${supplierOrder.bdc_number} de ${supplier?.name ?? supplierOrder.supplier_id}`
    ).catch(() => {})

    return Response.json({ success: true })
  } catch (error) {
    console.error('API Error [supplier-order mark-delivered]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
