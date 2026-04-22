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
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session || session.user.user_metadata?.role !== 'admin') {
    return { error: 'Non autorisé' }
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

  revalidatePath(`/catalogue/${payload.slug}`, 'page')
  revalidatePath('/catalogue', 'page')

  return {}
}
