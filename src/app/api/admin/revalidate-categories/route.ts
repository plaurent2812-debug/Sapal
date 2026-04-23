import { NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  revalidateTag('categories', 'default')
  revalidatePath('/catalogue', 'layout')
  return NextResponse.json({ ok: true })
}
