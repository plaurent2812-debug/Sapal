import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'
import { getResendClient } from '@/lib/resend-client'
import type { NextRequest } from 'next/server'

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params

    // Auth check: admin or gerant only
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const role = (user.user_metadata?.role as string) ?? 'client'
    if (role !== 'admin' && role !== 'gerant') {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const supabase = createServiceRoleClient()

    // Update account_status to active
    const { data: profile, error: updateError } = await supabase
      .from('client_profiles')
      .update({ account_status: 'active', updated_at: new Date().toISOString() })
      .eq('user_id', id)
      .select('company_name, client_type')
      .single()

    if (updateError) {
      console.error('Error activating client:', updateError)
      return Response.json({ error: 'Erreur lors de l\'activation du compte' }, { status: 500 })
    }

    // Get user email from auth
    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(id)

    if (authUserError || !authUser?.user) {
      console.error('Error fetching auth user:', authUserError)
      return Response.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    const clientEmail = authUser.user.email ?? ''
    const companyName = profile?.company_name ?? 'Votre entreprise'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sapal.fr'

    // Send welcome email via Resend (non-blocking on failure)
    const resend = getResendClient()
    if (resend && clientEmail) {
      resend.emails.send({
        from: 'noreply@opti-pro.fr',
        to: clientEmail,
        subject: 'Votre compte SAPAL est activé',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">Votre compte SAPAL est activé</h2>
            <p>Bonjour,</p>
            <p>
              Nous avons le plaisir de vous informer que votre compte client
              <strong>${companyName}</strong> sur SAPAL Signalisation a été validé et activé.
            </p>
            <p>Vous pouvez désormais vous connecter et accéder à votre espace client :</p>
            <p style="margin: 24px 0;">
              <a
                href="${siteUrl}/connexion"
                style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;"
              >
                Se connecter
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              Si vous avez des questions, n'hésitez pas à nous contacter à
              <a href="mailto:societe@sapal.fr">societe@sapal.fr</a>
            </p>
            <p style="color: #666; font-size: 14px;">
              L'équipe SAPAL Signalisation
            </p>
          </div>
        `,
      }).catch((err) => {
        console.error('Failed to send welcome email:', err)
      })
    }

    // Telegram notification (non-blocking)
    sendTelegramMessage(
      `✅ *Compte client activé*\n\n` +
      `📧 ${clientEmail}\n` +
      `🏢 ${companyName}\n` +
      `👤 Activé par : ${user.email}`
    ).catch((err) => {
      console.error('Failed to send Telegram notification:', err)
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
