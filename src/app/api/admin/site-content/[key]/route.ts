import { z } from 'zod'
import { requireAdmin } from '@/lib/site-content/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

const patchSchema = z.object({
  page: z.string().min(1),
  // valeur libre JSON (texte, objet image, liste, cta)
  value: z.unknown(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { user, error: authError } = await requireAdmin()
  if (authError) return authError

  const { key } = await params
  if (!key) return Response.json({ error: 'Clé manquante' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { page, value } = parsed.data

  const supabase = createServiceRoleClient()

  // Upsert : on met à jour draft_value uniquement.
  const { data, error } = await supabase
    .from('site_content')
    .upsert(
      {
        key,
        page,
        draft_value: value as never,
        updated_by: user.id,
      },
      { onConflict: 'key' }
    )
    .select()
    .single()

  if (error) {
    console.error('[site-content] PATCH error', error)
    return Response.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
  }

  return Response.json({ row: data })
}
