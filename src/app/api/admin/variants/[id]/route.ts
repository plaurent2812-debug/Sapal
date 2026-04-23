import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

const variantPatchSchema = z.object({
  price: z.number().min(0, 'Le prix doit être positif').optional(),
  delai: z.string().optional(),
  images: z.array(z.string()).optional(),
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
    const parsed = variantPatchSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const updatePayload: Record<string, unknown> = {}
    if (data.price !== undefined) updatePayload.price = data.price
    if (data.delai !== undefined) updatePayload.delai = data.delai.trim()
    if (data.images !== undefined) updatePayload.images = data.images.map(u => u.trim()).filter(Boolean)

    if (Object.keys(updatePayload).length === 0) {
      return Response.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: variant, error } = await supabase
      .from('product_variants')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating variant:', error)
      return Response.json({ error: 'Erreur lors de la mise à jour de la variante' }, { status: 500 })
    }

    revalidateTag('products', 'default')

    return Response.json({ variant })
  } catch (err) {
    console.error('API Error:', err)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
