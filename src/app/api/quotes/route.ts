import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { generateQuotePDF } from '@/lib/pdf/generate-quote-pdf'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendTelegramMessage, sendTelegramDocument } from '@/lib/telegram'
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
    delai: z.string().optional(),
  })).min(1),
})

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!checkRateLimit(ip, 10, 60000)) {
    return Response.json({ error: 'Trop de requêtes, réessayez dans 1 minute' }, { status: 429 })
  }

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

    const supabase = createServiceRoleClient()
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

    // Associer le devis au compte client connecté si disponible
    try {
      const supabaseAuth = await createServerSupabaseClient()
      const { data: { user } } = await supabaseAuth.auth.getUser()
      if (user && user.user_metadata?.role === 'client') {
        await supabase.from('quotes').update({ user_id: user.id }).eq('id', quoteId)
      }
    } catch {
      // Silently fail — les devis anonymes restent valides sans user_id
    }

    // Récupérer les références produits pour le PDF
    const productIds = items.map(i => i.productId)
    const { data: products } = await supabase
      .from('products')
      .select('id, reference')
      .in('id', productIds)
    const refMap = new Map((products ?? []).map((p: { id: string; reference: string }) => [p.id, p.reference || '']))

    // Générer le PDF
    const pdfData = {
      quoteId,
      date: new Date().toLocaleDateString('fr-FR'),
      entity,
      contactName,
      email,
      phone,
      items: items.map(i => ({
        reference: refMap.get(i.productId) || '',
        productName: i.productName,
        quantity: i.quantity,
        unitPriceHT: i.unitPrice || 0,
        delai: i.delai,
      })),
    }
    const doc = generateQuotePDF(pdfData)
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    // Notification Telegram asynchrone (Non-Bloquant pour l'utilisateur)
    sendTelegramNotification({ entity, contactName, email, phone, items, quoteId, pdfBuffer }).catch(e => {
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
  items: { productId: string; productName: string; quantity: number; unitPrice?: number; delai?: string }[]
  quoteId: string
  pdfBuffer: Buffer
}) {
  const itemsList = params.items
    .map(i => {
      let line = `  - ${i.productName} x${i.quantity}`
      if (i.unitPrice && i.unitPrice > 0) {
        const subtotal = (i.unitPrice * i.quantity).toFixed(2)
        line += ` (${subtotal} € HT)`
      }
      if (i.delai) {
        line += ` — Délai: ${/^\d+$/.test(i.delai) ? `${i.delai} semaines` : i.delai}`
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

  // Envoyer le message texte
  await sendTelegramMessage(text)

  // Envoyer le PDF
  const shortRef = params.quoteId.replace(/-/g, '').slice(0, 8).toUpperCase()
  await sendTelegramDocument(
    params.pdfBuffer,
    `devis-${shortRef}.pdf`,
    `📎 Devis ${shortRef} — ${params.entity}`
  )
}
