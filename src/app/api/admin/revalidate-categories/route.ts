import { NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Invalide les caches `unstable_cache` du catalogue.
 * Accepte ?tags=products,categories (défaut = les deux).
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const url = new URL(request.url)
  const raw = url.searchParams.get('tags')
  const tags = raw ? raw.split(',').map(t => t.trim()).filter(Boolean) : ['products', 'categories']

  for (const tag of tags) {
    revalidateTag(tag, 'default')
  }
  revalidatePath('/catalogue', 'layout')

  return NextResponse.json({ ok: true, tags })
}
