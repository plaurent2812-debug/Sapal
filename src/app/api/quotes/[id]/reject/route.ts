import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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

    // 5. Notifications gérant (non-blocking)
    const identifier = quote.entity || quote.contact_name || quote.email
    const shortId = id.replace(/-/g, '').slice(0, 8).toUpperCase()

    // Telegram
    sendTelegramMessage(
      `❌ *Devis refusé*\n\n` +
      `📋 Devis : ${shortId}\n` +
      `🏢 Client : ${identifier}\n` +
      `📧 Email : ${quote.email}`
    ).catch(() => {})

    // Email gérant
    const gerantEmail = process.env.SAPAL_GERANT_EMAIL
    if (gerantEmail) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sapal-site.vercel.app'
      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'SAPAL Signalisation <noreply@opti-pro.fr>',
        to: gerantEmail,
        subject: `Devis refusé — ${identifier} (Réf. ${shortId})`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#dc2626;color:white;padding:24px;border-radius:8px 8px 0 0">
              <h1 style="margin:0;font-size:20px">Devis refusé</h1>
              <p style="margin:4px 0 0;opacity:0.8;font-size:14px">Réf. ${shortId}</p>
            </div>
            <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
              <p>Le client <strong>${identifier}</strong> a refusé son devis.</p>
              <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;font-size:14px">
                <p style="margin:0"><strong>Client :</strong> ${identifier}</p>
                <p style="margin:8px 0 0"><strong>Email :</strong> ${quote.email}</p>
              </div>
              <div style="text-align:center;margin:24px 0">
                <a href="${siteUrl}/admin/devis" style="background:#1e293b;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold">Voir les devis</a>
              </div>
            </div>
          </div>
        `,
      }).catch((err) => console.error('Gérant reject email error:', err))
    }

    // 6. Return success
    return Response.json({ success: true })
  } catch (error) {
    console.error('API Error [reject quote]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
