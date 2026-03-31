import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().min(1),
  message: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = contactSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, email, phone, subject, message } = parsed.data

    const supabase = createServerClient()
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

    // Notification Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (token && chatId) {
      const text = [
        `📩 *Nouveau message de contact*`,
        ``,
        `*Nom :* ${name}`,
        `*Email :* ${email}`,
        phone ? `*Tél :* ${phone}` : '',
        `*Sujet :* ${subject}`,
        ``,
        `*Message :*`,
        message,
      ].filter(Boolean).join('\n')

      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown',
          }),
        })
      } catch (err) {
        console.error('Telegram notification failed:', err)
      }
    }

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
