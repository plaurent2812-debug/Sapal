import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

const productPatchSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').optional(),
  description: z.string().optional(),
  price: z.number().min(0, 'Le prix doit être positif').optional(),
  image_url: z.string().optional(),
  specifications: z.record(z.string(), z.string()).optional(),
})

async function checkAdmin() {
  const authClient = await createServerSupabaseClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    return { user: null, error: Response.json({ error: 'Non autorisé' }, { status: 401 }) }
  }

  const role = (user.user_metadata?.role as string) ?? 'client'
  if (role !== 'admin') {
    return { user: null, error: Response.json({ error: 'Accès refusé' }, { status: 403 }) }
  }

  return { user, error: null }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await checkAdmin()
    if (authError) return authError

    const { id } = await params
    const body = await request.json()
    const parsed = productPatchSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const updatePayload: Record<string, unknown> = {}
    if (data.name !== undefined) updatePayload.name = data.name.trim()
    if (data.description !== undefined) updatePayload.description = data.description.trim()
    if (data.price !== undefined) updatePayload.price = data.price
    if (data.image_url !== undefined) updatePayload.image_url = data.image_url.trim()
    if (data.specifications !== undefined) updatePayload.specifications = data.specifications

    if (Object.keys(updatePayload).length === 0) {
      return Response.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: product, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating product:', error)
      return Response.json({ error: 'Erreur lors de la mise à jour du produit' }, { status: 500 })
    }

    return Response.json({ product })
  } catch (err) {
    console.error('API Error:', err)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
