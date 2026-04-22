'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface UpdateCategoryPayload {
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  universe?: string | null
  previous_slug?: string
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload
): Promise<{ error?: string; universe?: string | null }> {
  const supabase = await createServerSupabaseClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.user_metadata?.role !== 'admin') {
    return { error: 'Non autorisé' }
  }

  if (!id || typeof id !== 'string') {
    return { error: 'ID invalide' }
  }
  if (!payload.name.trim() || !payload.slug.trim()) {
    return { error: 'Le nom et le slug sont requis' }
  }
  if (!/^[a-z0-9-]+$/.test(payload.slug.trim())) {
    return { error: 'Slug invalide (lettres minuscules, chiffres et tirets uniquement)' }
  }
  if (!Number.isInteger(payload.sort_order) || payload.sort_order < 0) {
    return { error: 'Ordre d\'affichage invalide' }
  }

  const { error } = await supabase
    .from('categories')
    .update({
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      image_url: payload.image_url,
      sort_order: payload.sort_order,
      ...(payload.universe !== undefined ? { universe: payload.universe } : {}),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  const { data: updated } = await supabase
    .from('categories')
    .select('universe')
    .eq('id', id)
    .single()

  revalidatePath(`/catalogue/${payload.slug}`, 'page')
  revalidatePath('/catalogue', 'page')
  if (payload.previous_slug && payload.previous_slug !== payload.slug) {
    revalidatePath(`/catalogue/${payload.previous_slug}`, 'page')
  }

  return { universe: updated?.universe ?? null }
}
