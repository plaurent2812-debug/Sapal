import { createServiceRoleClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendTelegramMessage } from '@/lib/telegram'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  company_name: z.string().min(1, 'Nom de l\'entreprise requis'),
  siret: z.string().regex(/^\d{14}$/, 'Le SIRET doit contenir 14 chiffres'),
  tva_intracom: z.string().regex(/^FR\d{11}$/, 'Format TVA invalide').optional().or(z.literal('')),
  client_type: z.enum(['B2B', 'B2C', 'collectivite']),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
})

export async function POST(request: Request) {
  // 1. Rate limit (5 per minute — stricter than quotes)
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!checkRateLimit(ip, 5, 60000)) {
    return Response.json({ error: 'Trop de tentatives' }, { status: 429 })
  }

  try {
    // 2. Parse + validate
    const body = await request.json()
    const result = registerSchema.safeParse(body)

    if (!result.success) {
      return Response.json({ error: result.error.issues[0].message }, { status: 400 })
    }

    const data = result.data

    // 3. Create user via service role (admin API)
    const supabase = createServiceRoleClient()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      user_metadata: { role: 'client' },
      email_confirm: true, // Auto-confirm email (SAPAL validates manually)
    })

    if (authError) {
      console.error('Supabase auth createUser error:', authError)
      if (authError.message.includes('already')) {
        return Response.json({ error: 'Un compte existe déjà avec cet email' }, { status: 409 })
      }
      return Response.json({ error: 'Erreur lors de la création du compte' }, { status: 500 })
    }

    // 4. Create client_profiles entry
    const { error: profileError } = await supabase.from('client_profiles').insert({
      user_id: authData.user.id,
      company_name: data.company_name,
      siret: data.siret,
      tva_intracom: data.tva_intracom || null,
      client_type: data.client_type,
      address: data.address || null,
      postal_code: data.postal_code || null,
      city: data.city || null,
      phone: data.phone || null,
      account_status: 'pending',
    })

    if (profileError) {
      console.error('Supabase client_profiles insertion error:', profileError)
      // Rollback: delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      return Response.json({ error: 'Erreur lors de la création du profil' }, { status: 500 })
    }

    // 5. Telegram notification (non-blocking)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sapal-signaletique.fr'
    sendTelegramMessage(
      `🆕 *Nouveau client à valider*\n\n` +
      `📧 ${data.email}\n` +
      `🏢 ${data.company_name}\n` +
      `📋 SIRET: ${data.siret}\n` +
      `📂 Type: ${data.client_type}\n\n` +
      `➡️ [Valider dans l'admin](${siteUrl}/admin/clients)`,
      {
        inline_keyboard: [[
          { text: '✅ Voir les clients', url: `${siteUrl}/admin/clients` }
        ]]
      }
    ).catch(() => {})

    // 6. Return success
    return Response.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
