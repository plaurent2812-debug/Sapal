import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateChorusPDF, type ChorusInvoiceItem } from '@/lib/pdf/generate-chorus-pdf'
import { getSapalSupplierDetails } from '@/lib/security-utils'
import type { NextRequest } from 'next/server'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params

    // 1. Auth check
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Non autoris\u00e9' }, { status: 401 })
    }
    const role = (user.user_metadata?.role as string) ?? 'client'

    const supabase = createServiceRoleClient()

    // 2. Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(id, product_name, variant_label, quantity, unit_price)')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return Response.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    // 3. Ownership check: client sees only their own; admin/gerant sees all
    if (role !== 'admin' && role !== 'gerant' && order.user_id !== user.id) {
      return Response.json({ error: 'Acc\u00e8s refus\u00e9' }, { status: 403 })
    }

    // 4. If Pennylane invoice URL exists, redirect to it
    if (order.invoice_url) {
      return Response.redirect(order.invoice_url, 302)
    }

    // 5. Generate local PDF using generateChorusPDF

    // Fetch client profile for address / SIRET / TVA
    let clientProfile: {
      siret?: string
      tva_intracom?: string
      address?: string
      postal_code?: string
      city?: string
      client_type?: string
      company_name?: string
      phone?: string
    } | null = null

    const { data: profile } = await supabase
      .from('client_profiles')
      .select('siret, tva_intracom, address, postal_code, city, client_type, company_name, phone')
      .eq('user_id', order.user_id)
      .single()

    if (profile) {
      clientProfile = profile
    }

    // Fetch user email for client block
    const { data: authUserData } = await supabase.auth.admin.getUserById(order.user_id)
    const clientEmail = authUserData?.user?.email ?? ''

    // Build invoice items from order_items
    type RawOrderItem = {
      product_name: string
      variant_label?: string | null
      quantity: number
      unit_price: number
    }

    const items: ChorusInvoiceItem[] = (order.order_items as RawOrderItem[]).map((item) => ({
      reference: '',
      productName: item.variant_label
        ? `${item.product_name} \u2014 ${item.variant_label}`
        : item.product_name,
      quantity: item.quantity,
      unitPriceHT: Number(item.unit_price) || 0,
    }))

    // Invoice number derived from order_number or order id
    const invoiceNumber = order.order_number
      ?? `FAC-${(order.id as string).replace(/-/g, '').slice(0, 8).toUpperCase()}`

    const invoiceDate = (order.invoiced_at as string | null) ?? (order.created_at as string)

    const doc = generateChorusPDF({
      invoiceNumber,
      date: invoiceDate,
      supplier: getSapalSupplierDetails(),
      client: {
        entity: clientProfile?.company_name ?? clientEmail,
        contactName: clientEmail,
        email: clientEmail,
        phone: clientProfile?.phone ?? '',
        siret: clientProfile?.siret ?? undefined,
        tvaIntracom: clientProfile?.tva_intracom ?? undefined,
        address: clientProfile?.address ?? undefined,
        postalCode: clientProfile?.postal_code ?? undefined,
        city: clientProfile?.city ?? undefined,
        clientType: clientProfile?.client_type ?? undefined,
      },
      items,
      tvaExempt: false,
    })

    const pdfBuffer = doc.output('arraybuffer')
    const safeNumber = invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '-')

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="facture-${safeNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Invoice PDF generation error:', error)
    return Response.json(
      { error: 'Erreur lors de la g\u00e9n\u00e9ration de la facture' },
      { status: 500 }
    )
  }
}
