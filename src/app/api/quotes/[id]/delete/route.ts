import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // 1. Auth check — admin ou gérant uniquement
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

    // 2. Récupérer le devis
    const { data: quote, error: quoteError } = await serviceClient
      .from('quotes')
      .select('id, status, pennylane_quote_id')
      .eq('id', id)
      .single()

    if (quoteError || !quote) {
      return Response.json({ error: 'Devis introuvable' }, { status: 404 })
    }

    // 3. Pennylane → annulation seule / Pas Pennylane → suppression
    if (quote.pennylane_quote_id) {
      // Annuler (garder la trace)
      const { error: updateError } = await serviceClient
        .from('quotes')
        .update({ status: 'cancelled' })
        .eq('id', id)

      if (updateError) {
        console.error('Quote cancel error:', updateError)
        return Response.json({ error: 'Erreur lors de l\'annulation' }, { status: 500 })
      }

      return Response.json({ success: true, action: 'cancelled' })
    } else {
      // Supprimer définitivement (pas dans Pennylane)
      // Supprimer les commandes rattachées si le devis était accepté
      if (quote.status === 'accepted') {
        const { data: orders } = await serviceClient
          .from('orders')
          .select('id')
          .eq('quote_id', id)

        if (orders && orders.length > 0) {
          const orderIds = orders.map((o: { id: string }) => o.id)
          // supplier_order_items → supplier_orders → order_items → orders
          for (const orderId of orderIds) {
            const { data: supplierOrders } = await serviceClient
              .from('supplier_orders')
              .select('id')
              .eq('order_id', orderId)
            if (supplierOrders && supplierOrders.length > 0) {
              const soIds = supplierOrders.map((so: { id: string }) => so.id)
              await serviceClient.from('supplier_order_items').delete().in('supplier_order_id', soIds)
              await serviceClient.from('supplier_orders').delete().eq('order_id', orderId)
            }
            await serviceClient.from('order_items').delete().eq('order_id', orderId)
          }
          await serviceClient.from('orders').delete().eq('quote_id', id)
        }
      }

      // quote_items puis devis
      await serviceClient
        .from('quote_items')
        .delete()
        .eq('quote_id', id)

      const { error: deleteError } = await serviceClient
        .from('quotes')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Quote delete error:', deleteError)
        return Response.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
      }

      return Response.json({ success: true, action: 'deleted' })
    }
  } catch (error) {
    console.error('API Error [delete quote]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
