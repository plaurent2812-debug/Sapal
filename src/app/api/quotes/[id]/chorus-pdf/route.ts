import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateChorusPDF, type ChorusInvoiceItem } from '@/lib/pdf/generate-chorus-pdf'
import type { NextRequest } from 'next/server'

// SAPAL supplier details (placeholders — replace with real data in production)
const SUPPLIER = {
  name: 'SAPAL Signalisation',
  siret: 'XXX XXX XXX XXXXX',
  tvaIntracom: 'FRXXXXXXXXXX',
  address: '260 Av. Michel Jourdan',
  postalCode: '06150',
  city: 'Cannes',
  phone: '06 22 90 28 54',
  email: 'societe@sapal.fr',
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
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

    // Try to fetch client profile (for SIRET / TVA intracom)
    const clientEmail = quote.email as string
    let clientProfile: {
      siret?: string
      tva_intracom?: string
      address?: string
      postal_code?: string
      city?: string
      client_type?: string
    } | null = null

    // Look up user by email to find their profile
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const matchedUser = authUsers?.users?.find(
      (u: { email?: string }) => u.email === clientEmail
    )

    if (matchedUser) {
      const { data: profile } = await supabase
        .from('client_profiles')
        .select('siret, tva_intracom, address, postal_code, city, client_type')
        .eq('user_id', matchedUser.id)
        .single()

      if (profile) {
        clientProfile = profile
      }
    }

    // Build invoice items
    const items: ChorusInvoiceItem[] = (
      quote.quote_items as {
        product_id: string
        product_name: string
        quantity: number
      }[]
    ).map((item) => {
      const product = productMap.get(item.product_id)
      return {
        reference: product?.reference ?? '',
        productName: item.product_name,
        quantity: item.quantity,
        unitPriceHT: product?.price ?? 0,
      }
    })

    // Invoice number: FAC-XXXXXXXX (based on quote ID)
    const shortRef = (quote.id as string).replace(/-/g, '').slice(0, 8).toUpperCase()
    const invoiceNumber = `FAC-${shortRef}`

    // Determine TVA exemption: if supplier is under "auto-entrepreneur" regime
    // For now default to non-exempt (TVA 20%). Can be toggled per config.
    const tvaExempt = false

    const doc = generateChorusPDF({
      invoiceNumber,
      date: quote.created_at as string,
      supplier: SUPPLIER,
      client: {
        entity: quote.entity as string,
        contactName: quote.contact_name as string,
        email: quote.email as string,
        phone: quote.phone as string,
        siret: clientProfile?.siret ?? undefined,
        tvaIntracom: clientProfile?.tva_intracom ?? undefined,
        address: clientProfile?.address ?? undefined,
        postalCode: clientProfile?.postal_code ?? undefined,
        city: clientProfile?.city ?? undefined,
        clientType: clientProfile?.client_type ?? undefined,
      },
      items,
      tvaExempt,
    })

    const pdfBuffer = doc.output('arraybuffer')

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="facture-chorus-${shortRef}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Chorus PDF generation error:', error)
    return Response.json(
      { error: 'Erreur lors de la g\u00e9n\u00e9ration de la facture Chorus' },
      { status: 500 }
    )
  }
}
