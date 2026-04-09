import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateBdcPDF } from '@/lib/pdf/generate-bdc-pdf'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Auth check — admin ou gérant
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'gerant') {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const serviceClient = createServiceRoleClient()

    // Fetch supplier_order
    const { data: so, error: soError } = await serviceClient
      .from('supplier_orders')
      .select('id, bdc_number, supplier_id, order_id, total_ht')
      .eq('id', id)
      .single()

    if (soError || !so) {
      return Response.json({ error: 'Commande fournisseur introuvable' }, { status: 404 })
    }

    // Fetch supplier
    const { data: supplier } = await serviceClient
      .from('suppliers')
      .select('name, email, address, postal_code, city, siret, contact_name')
      .eq('id', so.supplier_id)
      .single()

    // Fetch parent order for delivery address
    const { data: order } = await serviceClient
      .from('orders')
      .select('delivery_address, delivery_postal_code, delivery_city, user_id')
      .eq('id', so.order_id)
      .single()

    // Fetch client company name
    let clientCompanyName: string | undefined
    if (order?.user_id) {
      const { data: profile } = await serviceClient
        .from('client_profiles')
        .select('company_name')
        .eq('user_id', order.user_id)
        .single()
      clientCompanyName = profile?.company_name ?? undefined
    }

    // Fetch items
    const { data: items } = await serviceClient
      .from('supplier_order_items')
      .select('product_name, variant_label, quantity, unit_price')
      .eq('supplier_order_id', id)

    if (!items || items.length === 0) {
      return Response.json({ error: 'Aucun article trouvé' }, { status: 404 })
    }

    const totalHT = items.reduce(
      (sum: number, i: { unit_price: number; quantity: number }) => sum + i.unit_price * i.quantity,
      0
    )

    // Generate PDF
    const pdfBuffer = generateBdcPDF({
      bdcNumber: so.bdc_number,
      date: new Date().toLocaleDateString('fr-FR'),
      supplier: {
        name: supplier?.name ?? 'Fournisseur',
        email: supplier?.email ?? undefined,
        address: supplier?.address ?? undefined,
        postalCode: supplier?.postal_code ?? undefined,
        city: supplier?.city ?? undefined,
        siret: supplier?.siret ?? undefined,
        contactName: supplier?.contact_name ?? undefined,
      },
      delivery: order?.delivery_address ? {
        address: order.delivery_address,
        postalCode: order.delivery_postal_code ?? '',
        city: order.delivery_city ?? '',
        contactName: clientCompanyName,
      } : undefined,
      items: items.map((i: { product_name: string; variant_label?: string | null; quantity: number; unit_price: number }) => ({
        reference: '',
        name: i.product_name,
        variantLabel: i.variant_label ?? undefined,
        quantity: i.quantity,
        unitPrice: i.unit_price,
      })),
      totalHT,
    })

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="BDC-${so.bdc_number}.pdf"`,
      },
    })
  } catch (error) {
    console.error('API Error [bdc-pdf]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
