import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'

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

    // 2. Fetch quote and verify ownership
    const serviceClient = createServiceRoleClient()
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
      return Response.json({ error: 'Ce devis ne peut pas être refusé' }, { status: 400 })
    }

    // 4. Update quote status
    const { error: updateError } = await serviceClient
      .from('quotes')
      .update({ status: 'rejected' })
      .eq('id', id)

    if (updateError) {
      console.error('Quote reject update error:', updateError)
      return Response.json({ error: 'Erreur lors du refus du devis' }, { status: 500 })
    }

    // 5. Telegram notification (non-blocking)
    const identifier = quote.entity || quote.contact_name || quote.email
    const shortId = id.replace(/-/g, '').slice(0, 8).toUpperCase()
    sendTelegramMessage(
      `❌ *Devis refusé*\n\n` +
      `📋 Devis : ${shortId}\n` +
      `🏢 Client : ${identifier}\n` +
      `📧 Email : ${quote.email}`
    ).catch(() => {})

    // 6. Return success
    return Response.json({ success: true })
  } catch (error) {
    console.error('API Error [reject quote]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
