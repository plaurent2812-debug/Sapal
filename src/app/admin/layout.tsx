'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  FileText,
  LogOut,
  Users,
  Truck,
  ShoppingCart,
  Receipt,
  BarChart3,
  ArrowLeft,
} from 'lucide-react'

type UserRole = 'admin' | 'gerant' | 'client'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const adminNavItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/categories', label: 'Categories', icon: FolderOpen },
  { href: '/admin/produits', label: 'Produits', icon: Package },
  { href: '/admin/fournisseurs', label: 'Fournisseurs', icon: Truck },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/devis', label: 'Devis', icon: FileText },
  { href: '/admin/commandes', label: 'Commandes', icon: ShoppingCart },
  { href: '/admin/factures', label: 'Factures', icon: Receipt },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
]

const gerantNavItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/categories', label: 'Categories', icon: FolderOpen },
  { href: '/admin/produits', label: 'Produits', icon: Package },
  { href: '/admin/fournisseurs', label: 'Fournisseurs', icon: Truck },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/devis', label: 'Devis', icon: FileText },
  { href: '/admin/commandes', label: 'Commandes', icon: ShoppingCart },
  { href: '/admin/factures', label: 'Factures', icon: Receipt },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [role, setRole] = useState<UserRole>('client')
  const [userEmail, setUserEmail] = useState<string>('')

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && pathname !== '/admin/login') {
        router.push('/admin/login')
      } else {
        setAuthenticated(!!session)
        if (session) {
          const userRole = (session.user.user_metadata?.role as UserRole) || 'client'
          setRole(userRole)
          setUserEmail(session.user.email ?? '')
        }
      }
      setChecking(false)
    })
  }, [pathname, router])

  const handleLogout = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  // Login page renders without the admin shell but still covers site UI
  if (pathname === '/admin/login') {
    return <div className="fixed inset-0 z-[100] bg-background overflow-auto">{children}</div>
  }

  // Loading state while checking auth
  if (checking) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-3 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Chargement...</p>
        </div>
      </div>
    )
  }

  // Not authenticated (redirect in progress)
  if (!authenticated) {
    return null
  }

  const navItems = role === 'admin' ? adminNavItems : gerantNavItems
  const roleBadge = role === 'admin' ? 'Administrateur' : role === 'gerant' ? 'Gérant' : 'Gérant'

  return (
    <div className="fixed inset-0 flex bg-background z-[100]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-primary flex flex-col z-50">
        {/* Logo / Brand */}
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xl text-white tracking-tight">
              SAPAL
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/15 text-white/80 text-xs font-medium">
              {roleBadge}
            </span>
          </div>
          <p className="text-white/40 text-xs mt-1">Panneau d&apos;administration</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href) && item.href !== '/admin'
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User info & Logout */}
        <div className="px-3 py-4 border-t border-white/10 space-y-2">
          {userEmail && (
            <div className="px-4 py-2">
              <p className="text-white/50 text-xs truncate" title={userEmail}>
                {userEmail}
              </p>
            </div>
          )}
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors w-full"
          >
            <ArrowLeft size={20} />
            Retour au site
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors w-full cursor-pointer"
          >
            <LogOut size={20} />
            Deconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 p-8 overflow-auto">{children}</main>
    </div>
  )
}
