import { z } from 'zod'
import { requireAdmin } from '@/lib/site-content/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  keys: z.array(z.string()).optional(),
})

export async function POST(request: Request) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // body vide accepté → on efface tous les drafts
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Données invalides' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  let query = supabase
    .from('site_content')
    .update({ draft_value: null })
    .not('draft_value', 'is', null)

  if (parsed.data.keys && parsed.data.keys.length > 0) {
    query = query.in('key', parsed.data.keys)
  }

  const { data, error } = await query.select('key')

  if (error) {
    console.error('[site-content] discard error', error)
    return Response.json({ error: 'Erreur' }, { status: 500 })
  }

  return Response.json({ discardedCount: data?.length ?? 0 })
}
