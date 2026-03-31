import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const quoteSchema = z.object({
  entity: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  message: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().optional(),
  })).min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = quoteSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { entity, contactName, email, phone, message, items } = parsed.data
    const quoteId = randomUUID()

    const supabase = createServerClient()
    const { error: quoteError } = await supabase
      .from('quotes')
      .insert({
        id: quoteId,
        entity,
        contact_name: contactName,
        email,
        phone,
        message: message || null,
      })

    if (quoteError) {
      console.error('Supabase quote insertion error:', quoteError)
      return Response.json({ error: 'Erreur lors de l\'enregistrement du devis' }, { status: 500 })
    }

    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(
        items.map(i => ({
          quote_id: quoteId,
          product_id: i.productId,
          product_name: i.productName,
          quantity: i.quantity,
        }))
      )

    if (itemsError) {
      console.error('Supabase quote items insertion error:', itemsError)
      return Response.json({ error: `Erreur lors de l'enregistrement des articles: ${itemsError.message}` }, { status: 500 })
    }

    // Notification Telegram asynchrone (Non-Bloquant pour l'utilisateur)
    sendTelegramNotification({ entity, contactName, email, phone, items, quoteId }).catch(e => {
      console.error('Failed to send telegram notification:', e)
    })

    return Response.json({ success: true, quoteId })
  } catch (error) {
    console.error('API Error:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function sendTelegramNotification(params: {
  entity: string
  contactName: string
  email: string
  phone: string
  items: { productId: string; productName: string; quantity: number; unitPrice?: number }[]
  quoteId: string
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  const itemsList = params.items
    .map(i => {
      const line = `  - ${i.productName} x${i.quantity}`
      if (i.unitPrice && i.unitPrice > 0) {
        const subtotal = (i.unitPrice * i.quantity).toFixed(2)
        return `${line} (${subtotal} € HT)`
      }
      return line
    })
    .join('\n')

  const totalHT = params.items.reduce((sum, i) => sum + (i.unitPrice || 0) * i.quantity, 0)

  const text = [
    `📋 *Nouvelle demande de devis*`,
    ``,
    `*Entité :* ${params.entity}`,
    `*Contact :* ${params.contactName}`,
    `*Email :* ${params.email}`,
    `*Tél :* ${params.phone}`,
    ``,
    `*Produits :*`,
    itemsList,
    ``,
    totalHT > 0 ? `💰 *Total estimé HT :* ${totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '',
    ``,
    `_Réf : ${params.quoteId}_`,
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
