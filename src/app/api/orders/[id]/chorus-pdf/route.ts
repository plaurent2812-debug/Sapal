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

    // Only admins and gérants can generate invoices
    if (role !== 'admin' && role !== 'gerant') {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const supabase = createServiceRoleClient()

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return Response.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    // Only generate invoices for delivered or invoiced orders
    if (order.status !== 'delivered' && order.status !== 'invoiced') {
      return Response.json(
        { error: 'La facture ne peut être générée que pour les commandes livrées ou facturées' },
        { status: 400 }
      )
    }

    // Fetch client profile via user_id (direct FK)
    let clientProfile: {
      siret?: string
      tva_intracom?: string
      address?: string
      postal_code?: string
      city?: string
      client_type?: string
      entity?: string
      contact_name?: string
      phone?: string
    } | null = null

    if (order.user_id) {
      const { data: profile } = await supabase
        .from('client_profiles')
        .select('siret, tva_intracom, address, postal_code, city, client_type, entity, contact_name, phone')
        .eq('user_id', order.user_id)
        .single()

      if (profile) {
        clientProfile = profile
      }
    }

    // Fetch client email via auth admin
    let clientEmail = ''
    if (order.user_id) {
      const { data: authUserData } = await supabase.auth.admin.getUserById(order.user_id)
      if (authUserData?.user?.email) {
        clientEmail = authUserData.user.email
      }
    }

    // Fallback: try to get entity/contact from the linked quote
    let quoteEntity = clientProfile?.entity ?? ''
    let quoteContact = clientProfile?.contact_name ?? ''
    let quotePhone = clientProfile?.phone ?? ''

    if (!quoteEntity && order.quote_id) {
      const { data: quote } = await supabase
        .from('quotes')
        .select('entity, contact_name, phone, email')
        .eq('id', order.quote_id)
        .single()

      if (quote) {
        quoteEntity = quote.entity ?? ''
        quoteContact = quote.contact_name ?? ''
        quotePhone = quote.phone ?? ''
        if (!clientEmail) clientEmail = quote.email ?? ''
      }
    }

    // Build invoice items (order_items already carries unit_price)
    const items: ChorusInvoiceItem[] = (
      order.order_items as {
        id: string
        product_name: string
        quantity: number
        unit_price: number
        product_reference?: string
      }[]
    ).map((item) => ({
      reference: item.product_reference ?? '',
      productName: item.product_name,
      quantity: item.quantity,
      unitPriceHT: Number(item.unit_price) || 0,
    }))

    // Invoice number: replace CMD prefix with FAC
    // e.g. CMD-20260403-0001 → FAC-20260403-0001
    const invoiceNumber = (order.order_number as string).replace(/^CMD-/, 'FAC-')

    const tvaExempt = false

    const doc = generateChorusPDF({
      invoiceNumber,
      date: order.created_at as string,
      supplier: SUPPLIER,
      client: {
        entity: quoteEntity,
        contactName: quoteContact,
        email: clientEmail,
        phone: quotePhone,
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
    const safeNumber = invoiceNumber.replace(/[^A-Z0-9-]/gi, '-')

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="facture-chorus-${safeNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Chorus PDF generation error (order):', error)
    return Response.json(
      { error: 'Erreur lors de la génération de la facture Chorus' },
      { status: 500 }
    )
  }
}
