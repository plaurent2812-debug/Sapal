import { requireAdmin } from '@/lib/site-content/auth'
import { createServiceRoleClient } from '@/lib/supabase/server'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image'
}

export async function POST(request: Request) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const form = await request.formData()
  const file = form.get('file')
  const page = (form.get('page') as string | null) ?? 'misc'

  if (!(file instanceof File)) {
    return Response.json({ error: 'Fichier manquant' }, { status: 400 })
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return Response.json(
      { error: `Type non autorisé (${file.type}). Autorisés : JPEG, PNG, WebP, AVIF.` },
      { status: 400 }
    )
  }

  if (file.size > MAX_SIZE) {
    return Response.json(
      { error: `Fichier trop volumineux (${Math.round(file.size / 1024)} KB, max 5 MB)` },
      { status: 400 }
    )
  }

  const safePage = slugify(page)
  const ext = EXT_BY_MIME[file.type] ?? 'bin'
  const baseName = slugify(file.name.replace(/\.[^.]+$/, ''))
  const timestamp = Date.now()
  const path = `${safePage}/${timestamp}-${baseName}.${ext}`

  const supabase = createServiceRoleClient()
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('site-content')
    .upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('[site-content] upload error', uploadError)
    return Response.json({ error: 'Erreur upload' }, { status: 500 })
  }

  const { data } = supabase.storage.from('site-content').getPublicUrl(path)
  return Response.json({ url: data.publicUrl, path })
}
