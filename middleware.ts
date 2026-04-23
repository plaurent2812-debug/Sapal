import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Get role from JWT (user_metadata with app_metadata fallback)
  const { data: { session } } = await supabase.auth.getSession()
  const role = session?.user?.user_metadata?.role ?? session?.user?.app_metadata?.role

  // Category redirect lookup : si une URL /catalogue/<slug> ou /catalogue/fournisseurs/<supplier>/<slug>
  // pointe vers un slug qui n'existe plus en catégorie, on cherche dans category_redirects.
  if (pathname.startsWith('/catalogue/')) {
    const segments = pathname.split('/').filter(Boolean) // ['catalogue', ...]
    const lastSlug = segments[segments.length - 1]

    if (lastSlug && segments.length >= 2) {
      // On ne vérifie que les chemins purement "catégorie" (pas les fiches produit qui ont 3+ segments après 'catalogue')
      // Format catégorie : /catalogue/<slug> ou /catalogue/fournisseurs/procity/<slug>
      const isCategoryPath =
        segments.length === 2 ||
        (segments.length === 4 && segments[1] === 'fournisseurs')

      if (isCategoryPath) {
        const { data: activeCat } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', lastSlug)
          .maybeSingle()

        if (!activeCat) {
          const { data: redirect } = await supabase
            .from('category_redirects')
            .select('categories(slug)')
            .eq('old_slug', lastSlug)
            .maybeSingle()

          const newSlug = (redirect?.categories as { slug?: string } | null)?.slug
          if (newSlug) {
            const newSegments = [...segments.slice(0, -1), newSlug]
            const url = request.nextUrl.clone()
            url.pathname = '/' + newSegments.join('/')
            return NextResponse.redirect(url, 301)
          }
        }
      }
    }
  }

  // Protected admin pages (except login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    // Only admin can access /admin — redirect others
    if (role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = role === 'gerant' ? '/gerant' : role === 'client' ? '/mon-compte' : '/connexion'
      return NextResponse.redirect(url)
    }
  }

  // Protected gerant pages
  if (pathname.startsWith('/gerant')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/connexion'
      return NextResponse.redirect(url)
    }

    // Only gerant role can access /gerant/*
    if (role !== 'gerant') {
      const url = request.nextUrl.clone()
      url.pathname = role === 'admin' ? '/admin' : '/connexion'
      return NextResponse.redirect(url)
    }
  }

  // Protected client account pages
  if (pathname.startsWith('/mon-compte')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/connexion'
      return NextResponse.redirect(url)
    }

    if (role !== 'client') {
      const url = request.nextUrl.clone()
      url.pathname = role === 'gerant' ? '/gerant' : '/admin'
      return NextResponse.redirect(url)
    }

    const { data: profile } = await supabase
      .from('client_profiles')
      .select('account_status')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.account_status !== 'active') {
      const url = request.nextUrl.clone()
      url.pathname = '/compte-en-attente'
      return NextResponse.redirect(url)
    }
  }

  // Protected API routes (PDF endpoints)
  if (pathname.match(/^\/api\/quotes\/[^/]+\/(pdf|chorus-pdf)$/)) {
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }
  }

  // Protected API routes (orders, supplier orders, invoices, clients)
  if (
    pathname.startsWith('/api/orders/') ||
    pathname.startsWith('/api/supplier-orders/') ||
    pathname.startsWith('/api/invoices/') ||
    pathname.startsWith('/api/clients/')
  ) {
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/gerant/:path*',
    '/mon-compte/:path*',
    '/api/quotes/:id/pdf',
    '/api/quotes/:id/chorus-pdf',
    '/api/orders/:path*',
    '/api/supplier-orders/:path*',
    '/api/invoices/:path*',
    '/api/clients/:path*',
    '/catalogue/:path*',
  ],
}
