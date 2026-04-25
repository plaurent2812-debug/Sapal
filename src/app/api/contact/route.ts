import { createServiceRoleClient } from '@/lib/supabase/server'
import { limitByIP, getClientIP } from '@/lib/rate-limit-upstash'
import { sendTelegramMessage } from '@/lib/telegram'
import { escapeTelegramMarkdown } from '@/lib/security-utils'
import { Resend } from 'resend'
import { z } from 'zod'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const resend = new Resend(process.env.RESEND_API_KEY)

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().min(1),
  message: z.string().min(1),
})

export async function POST(request: Request) {
  const ip = getClientIP(request)
  const rateLimitResult = await limitByIP(ip, 'CONTACT')
  if (!rateLimitResult.success) {
    return Response.json(
      { error: 'Trop de requêtes, réessayez dans une heure' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.reset),
        },
      }
    )
  }

  try {
    const body = await request.json()
    const parsed = contactSchema.safeParse(body)

    if (!parsed.success) {
      console.error('Validation error:', parsed.error.flatten())
      return Response.json(
        { error: 'Données invalides' },
        { status: 400 }
      )
    }

    const { name, email, phone, subject, message } = parsed.data

    const supabase = createServiceRoleClient()
    const { error } = await supabase
      .from('contacts')
      .insert({
        name,
        email,
        phone: phone || null,
        subject,
        message,
      })

    if (error) {
      console.error('Supabase error:', error)
      return Response.json({ error: 'Erreur lors de l\'enregistrement' }, { status: 500 })
    }

    // Envoi email via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const emailResult = await resend.emails.send({
          from: 'noreply@opti-pro.fr',
          to: 'p.laurent@opti-pro.fr',
          subject: `Nouveau message de contact: ${escapeHtml(subject)}`,
          html: `
            <h2>Nouveau message de contact</h2>
            <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
            <p><strong>Email :</strong> ${escapeHtml(email)}</p>
            ${phone ? `<p><strong>Téléphone :</strong> ${escapeHtml(phone)}</p>` : ''}
            <p><strong>Sujet :</strong> ${escapeHtml(subject)}</p>
            <h3>Message :</h3>
            <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
          `,
          replyTo: email,
        })
        console.log('Email sent successfully:', emailResult)
      } catch (err) {
        console.error('Email sending failed:', err)
      }
    } else {
      console.warn('RESEND_API_KEY not configured')
    }

    // Notification Telegram
    const telegramText = [
      `📩 *Nouveau message de contact*`,
      ``,
      `*Nom :* ${escapeTelegramMarkdown(name)}`,
      `*Email :* ${escapeTelegramMarkdown(email)}`,
      phone ? `*Tél :* ${escapeTelegramMarkdown(phone)}` : '',
      `*Sujet :* ${escapeTelegramMarkdown(subject)}`,
      ``,
      `*Message :*`,
      escapeTelegramMarkdown(message),
    ].filter(Boolean).join('\n')

    sendTelegramMessage(telegramText).catch(e => {
      console.error('Failed to send telegram notification:', e)
    })

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
