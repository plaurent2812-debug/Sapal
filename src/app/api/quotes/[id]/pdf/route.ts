import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateQuotePDF, type QuotePDFItem } from '@/lib/pdf/generate-quote-pdf'
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/quotes/[id]/pdf'>
) {
  try {
    const { id } = await ctx.params

    // Auth check: verify user and role
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Non autorisé' }, { status: 401 })
    }
    const role = (user.user_metadata?.role as string) ?? 'client'

    const supabase = createServiceRoleClient()

    // Fetch quote with items
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('id', id)
      .single()

    if (quoteError || !quote) {
      return Response.json({ error: 'Devis introuvable' }, { status: 404 })
    }

    // Authorization: admin/gerant can access all, clients only their own
    if (role !== 'admin' && role !== 'gerant' && quote.email !== user.email) {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Fetch product prices for all items
    const productIds = (quote.quote_items as { product_id: string }[]).map(
      (item) => item.product_id
    )

    const { data: products } = await supabase
      .from('products')
      .select('id, price, reference')
      .in('id', productIds)

    const productMap = new Map(
      (products ?? []).map((p: { id: string; price: number; reference: string }) => [
        p.id,
        { price: Number(p.price) || 0, reference: p.reference || '' },
      ])
    )

    // Build PDF data
    const items: QuotePDFItem[] = (
      quote.quote_items as {
        product_id: string
        product_name: string
        quantity: number
        unit_price?: number
        delai?: string
      }[]
    ).map((item) => {
      const product = productMap.get(item.product_id)
      return {
        reference: product?.reference ?? '',
        productName: item.product_name,
        quantity: item.quantity,
        unitPriceHT: (item.unit_price && item.unit_price > 0) ? item.unit_price : (product?.price ?? 0),
        delai: item.delai || undefined,
      }
    })

    const date = new Date(quote.created_at as string).toLocaleDateString(
      'fr-FR',
      { day: '2-digit', month: '2-digit', year: 'numeric' }
    )

    const doc = generateQuotePDF({
      quoteId: quote.id as string,
      date,
      entity: quote.entity as string,
      contactName: quote.contact_name as string,
      email: quote.email as string,
      phone: quote.phone as string,
      items,
    })

    const pdfBuffer = doc.output('arraybuffer')
    const shortRef = (quote.id as string).replace(/-/g, '').slice(0, 8).toUpperCase()

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="devis-${shortRef}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return Response.json({ error: 'Erreur lors de la génération du PDF' }, { status: 500 })
  }
}
