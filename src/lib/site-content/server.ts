import 'server-only'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ContentValue, SiteContentRow } from './types'

/** Client anon (sans cookies) — utilisable dans `unstable_cache`. */
function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

/**
 * Charge toutes les clés publiées d'une page, en cache par page.
 * À appeler dans un Server Component.
 */
async function fetchSiteContentForPage(page: string): Promise<Record<string, ContentValue>> {
  const supabase = createAnonClient()

  const { data, error } = await supabase
    .from('site_content')
    .select('key, published_value')
    .eq('page', page)

  if (error) {
    console.error('[site-content] fetch error', error)
    return {}
  }

  const map: Record<string, ContentValue> = {}
  for (const row of (data as Pick<SiteContentRow, 'key' | 'published_value'>[]) ?? []) {
    map[row.key] = row.published_value
  }
  return map
}

/** Version cachée par page avec tag `site-content:{page}` — à utiliser en SSR. */
export function getSiteContent(page: string): Promise<Record<string, ContentValue>> {
  return unstable_cache(
    () => fetchSiteContentForPage(page),
    ['site-content', page],
    { tags: [`site-content:${page}`] }
  )()
}

/** Récupère la valeur publiée pour une clé (ou fallback si absente). */
export async function getPublishedValue<T>(page: string, key: string, fallback: T): Promise<T> {
  const map = await getSiteContent(page)
  const value = map[key]
  if (value === undefined || value === null) return fallback
  return value as unknown as T
}

/** Récupère les valeurs courantes (draft OU published si pas de draft) pour l'admin. */
export async function fetchSiteContentAdmin(page?: string): Promise<SiteContentRow[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase.from('site_content').select('*')
  if (page) query = query.eq('page', page)

  const { data, error } = await query
  if (error) {
    console.error('[site-content] admin fetch error', error)
    return []
  }
  return (data as SiteContentRow[]) ?? []
}
