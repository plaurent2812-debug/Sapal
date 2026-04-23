'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generateSlug } from '@/lib/utils'

export interface UpdateCategoryPayload {
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  universe?: string | null
  previous_slug?: string
}

async function assertAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.user_metadata?.role !== 'admin') {
    return { supabase, error: 'Non autorisé' as const }
  }
  return { supabase, error: null }
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload
): Promise<{ error?: string; universe?: string | null }> {
  const { supabase, error: authError } = await assertAdmin()
  if (authError) return { error: authError }

  if (!id) return { error: 'ID invalide' }
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

  // Auto-création de la redirection 301 si le slug change
  if (payload.previous_slug && payload.previous_slug !== payload.slug) {
    await supabase
      .from('category_redirects')
      .upsert({ old_slug: payload.previous_slug, category_id: id }, { onConflict: 'old_slug' })
  }

  const { data: updated } = await supabase
    .from('categories')
    .select('universe')
    .eq('id', id)
    .single()

  revalidateTag('categories')
  revalidatePath(`/catalogue/${payload.slug}`, 'page')
  revalidatePath('/catalogue', 'page')
  if (payload.previous_slug && payload.previous_slug !== payload.slug) {
    revalidatePath(`/catalogue/${payload.previous_slug}`, 'page')
  }

  return { universe: updated?.universe ?? null }
}

export interface CreateSubcategoryPayload {
  parent_id: string
  name: string
  image_url?: string
}

export async function createSubcategory(
  payload: CreateSubcategoryPayload
): Promise<{ error?: string; id?: string; slug?: string }> {
  const { supabase, error: authError } = await assertAdmin()
  if (authError) return { error: authError }

  const name = payload.name.trim()
  if (!name) return { error: 'Le nom est requis' }

  // Récupère le parent pour calculer level + supplier héritage + universe
  const { data: parent, error: parentErr } = await supabase
    .from('categories')
    .select('id, level, universe, slug')
    .eq('id', payload.parent_id)
    .single()

  if (parentErr || !parent) return { error: 'Catégorie parente introuvable' }

  const slug = generateSlug(name)
  if (!slug) return { error: 'Nom invalide (slug vide)' }

  // Vérifie l'unicité du slug
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) return { error: `Une catégorie avec le slug "${slug}" existe déjà` }

  // sort_order = max + 1 parmi les enfants
  const { data: siblings } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('parent_id', parent.id)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextSort = (siblings?.[0]?.sort_order ?? -1) + 1

  // id humain-lisible : slug (les IDs sont des TEXT dans ce projet)
  const newId = slug

  const { error: insertErr } = await supabase.from('categories').insert({
    id: newId,
    name,
    slug,
    description: '',
    image_url: payload.image_url?.trim() || '',
    parent_id: parent.id,
    level: (parent.level ?? 0) + 1,
    sort_order: nextSort,
    universe: parent.universe,
  })

  if (insertErr) return { error: insertErr.message }

  revalidateTag('categories')
  revalidatePath(`/catalogue/${parent.slug}`, 'page')
  revalidatePath('/catalogue', 'page')

  return { id: newId, slug }
}

export async function deleteSubcategory(
  id: string
): Promise<{ error?: string; productCount?: number; childrenCount?: number }> {
  const { supabase, error: authError } = await assertAdmin()
  if (authError) return { error: authError }

  // Récupère parent_slug avant suppression pour revalidatePath
  const { data: cat } = await supabase
    .from('categories')
    .select('id, parent_id, slug')
    .eq('id', id)
    .single()
  if (!cat) return { error: 'Catégorie introuvable' }

  // Check produits directs
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)

  if ((productCount ?? 0) > 0) {
    return {
      error: `Cette sous-catégorie contient ${productCount} produit${productCount! > 1 ? 's' : ''}. Déplace-les vers une autre catégorie avant de la supprimer.`,
      productCount: productCount ?? 0,
    }
  }

  // Check sous-sous-catégories
  const { count: childrenCount } = await supabase
    .from('categories')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', id)

  if ((childrenCount ?? 0) > 0) {
    return {
      error: `Cette catégorie contient ${childrenCount} sous-catégorie${childrenCount! > 1 ? 's' : ''}. Supprime-les d'abord.`,
      childrenCount: childrenCount ?? 0,
    }
  }

  const { error: delErr } = await supabase.from('categories').delete().eq('id', id)
  if (delErr) return { error: delErr.message }

  revalidateTag('categories')
  if (cat.parent_id) {
    const { data: parent } = await supabase
      .from('categories')
      .select('slug')
      .eq('id', cat.parent_id)
      .single()
    if (parent?.slug) revalidatePath(`/catalogue/${parent.slug}`, 'page')
  }
  revalidatePath('/catalogue', 'page')

  return {}
}

export async function reorderSubcategories(
  parentId: string,
  orderedIds: string[]
): Promise<{ error?: string }> {
  const { supabase, error: authError } = await assertAdmin()
  if (authError) return { error: authError }

  if (!orderedIds.length) return {}

  // Update chaque enfant avec son nouvel index
  const updates = orderedIds.map((childId, index) =>
    supabase
      .from('categories')
      .update({ sort_order: index })
      .eq('id', childId)
      .eq('parent_id', parentId)
  )

  const results = await Promise.all(updates)
  const firstErr = results.find(r => r.error)
  if (firstErr?.error) return { error: firstErr.error.message }

  revalidateTag('categories')
  const { data: parent } = await supabase
    .from('categories')
    .select('slug')
    .eq('id', parentId)
    .single()
  if (parent?.slug) revalidatePath(`/catalogue/${parent.slug}`, 'page')

  return {}
}
