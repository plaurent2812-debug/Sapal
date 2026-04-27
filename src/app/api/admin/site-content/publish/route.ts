import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/site-content/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { pagePathsFor } from '@/lib/site-content/types'

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
    // body vide accepté
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Données invalides' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Récupère les lignes à publier (celles avec un draft, filtrées par keys si fourni)
  let query = supabase
    .from('site_content')
    .select('key, page, draft_value')
    .not('draft_value', 'is', null)

  if (parsed.data.keys && parsed.data.keys.length > 0) {
    query = query.in('key', parsed.data.keys)
  }

  const { data: rows, error: fetchError } = await query
  if (fetchError) {
    console.error('[site-content] publish fetch error', fetchError)
    return Response.json({ error: 'Erreur lecture' }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return Response.json({ publishedCount: 0, pages: [] })
  }

  // Promotion draft → published, une mise à jour par ligne (petit volume attendu)
  const pagesTouched = new Set<string>()
  for (const row of rows as { key: string; page: string; draft_value: unknown }[]) {
    const { error: upErr } = await supabase
      .from('site_content')
      .update({ published_value: row.draft_value as never, draft_value: null })
      .eq('key', row.key)

    if (upErr) {
      console.error('[site-content] publish update error', row.key, upErr)
      return Response.json({ error: `Erreur publish ${row.key}` }, { status: 500 })
    }
    pagesTouched.add(row.page)
  }

  // Revalide le cache Next.js
  for (const page of pagesTouched) {
    revalidateTag(`site-content:${page}`, 'default')
  }
  for (const path of pagePathsFor(Array.from(pagesTouched))) {
    revalidatePath(path)
  }

  return Response.json({
    publishedCount: rows.length,
    pages: Array.from(pagesTouched),
  })
}
