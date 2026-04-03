import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const supplierSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  slug: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  siret: z
    .string()
    .regex(/^\d{14}$/, 'Le SIRET doit contenir 14 chiffres')
    .optional()
    .or(z.literal('')),
  contact_name: z.string().optional(),
  payment_terms: z.enum(['30j', 'prepayment']),
  notes: z.string().optional(),
})

async function checkAuth() {
  const authClient = await createServerSupabaseClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()

  if (!user) return { user: null, error: Response.json({ error: 'Non autorisé' }, { status: 401 }) }

  const role = (user.user_metadata?.role as string) ?? 'client'
  if (role !== 'admin' && role !== 'gerant') {
    return { user: null, error: Response.json({ error: 'Accès refusé' }, { status: 403 }) }
  }

  return { user, error: null }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await checkAuth()
    if (authError) return authError

    const { id } = await params
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return Response.json({ error: 'Fournisseur introuvable' }, { status: 404 })
    }

    return Response.json({ supplier: data })
  } catch (err) {
    console.error('API Error:', err)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await checkAuth()
    if (authError) return authError

    const { id } = await params
    const body = await request.json()
    const parsed = supplierSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const slug = data.slug?.trim() || generateSlug(data.name)

    const supabase = createServiceRoleClient()

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .update({
        name: data.name.trim(),
        slug,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        postal_code: data.postal_code?.trim() || null,
        city: data.city?.trim() || null,
        siret: data.siret?.trim() || null,
        contact_name: data.contact_name?.trim() || null,
        payment_terms: data.payment_terms,
        notes: data.notes?.trim() || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating supplier:', error)
      if (error.code === '23505') {
        return Response.json({ error: 'Un fournisseur avec ce slug existe déjà' }, { status: 409 })
      }
      return Response.json({ error: 'Erreur lors de la mise à jour du fournisseur' }, { status: 500 })
    }

    return Response.json({ supplier })
  } catch (err) {
    console.error('API Error:', err)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await checkAuth()
    if (authError) return authError

    const { id } = await params
    const supabase = createServiceRoleClient()

    // Check if any products reference this supplier
    const { count, error: countError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', id)

    if (countError) {
      console.error('Error checking products:', countError)
      return Response.json({ error: 'Erreur lors de la vérification des produits associés' }, { status: 500 })
    }

    if (count && count > 0) {
      return Response.json(
        { error: `Impossible de supprimer : ${count} produit(s) référencent ce fournisseur` },
        { status: 409 }
      )
    }

    const { error } = await supabase.from('suppliers').delete().eq('id', id)

    if (error) {
      console.error('Error deleting supplier:', error)
      return Response.json({ error: 'Erreur lors de la suppression du fournisseur' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('API Error:', err)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
