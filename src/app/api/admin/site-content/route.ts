import { requireAdmin } from '@/lib/site-content/auth'
import { fetchSiteContentAdmin } from '@/lib/site-content/server'

export async function GET(request: Request) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') || undefined

  const rows = await fetchSiteContentAdmin(page)
  return Response.json({ rows })
}
