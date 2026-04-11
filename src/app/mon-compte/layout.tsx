'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Receipt,
  User,
  LogOut,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const clientNavItems: NavItem[] = [
  { href: '/mon-compte', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/mon-compte/devis', label: 'Mes Devis', icon: FileText },
  { href: '/mon-compte/commandes', label: 'Mes Commandes', icon: ShoppingCart },
  { href: '/mon-compte/factures', label: 'Mes Factures', icon: Receipt },
  { href: '/mon-compte/profil', label: 'Mon Profil', icon: User },
]

export default function MonCompteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [userEmail, setUserEmail] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const closeSidebar = () => setSidebarOpen(false)

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/connexion')
        setChecking(false)
        return
      }

      const userRole = (session.user.user_metadata?.role as string) || 'client'

      if (userRole !== 'client') {
        router.push('/admin')
        setChecking(false)
        return
      }

      setAuthenticated(true)
      setUserEmail(session.user.email ?? '')
      setChecking(false)
    })
  }, [pathname, router])

  const handleLogout = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/connexion')
  }

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

  if (!authenticated) {
    return null
  }

  return (
    <div className="fixed inset-0 flex bg-background z-[100]">
      {/* Mobile top bar with hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-primary border-b border-white/10">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-lg text-white tracking-tight">SAPAL</h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/15 text-white/80 text-[11px] font-medium">
            Client
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer touch-manipulation"
          aria-label="Ouvrir le menu"
          aria-expanded={sidebarOpen}
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-[85vw] max-w-[288px] lg:w-64 bg-primary flex flex-col z-50 shadow-2xl lg:shadow-none transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo / Brand */}
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl text-white tracking-tight">
                SAPAL
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/15 text-white/80 text-xs font-medium">
                Client
              </span>
            </div>
            <p className="text-white/40 text-xs mt-1">Mon espace client</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer touch-manipulation"
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {clientNavItems.map((item) => {
            const isActive =
              item.href === '/mon-compte'
                ? pathname === '/mon-compte'
                : pathname.startsWith(item.href) && item.href !== '/mon-compte'
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors touch-manipulation ${
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
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors w-full touch-manipulation"
          >
            <ArrowLeft size={20} />
            Retour au site
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors w-full cursor-pointer touch-manipulation"
          >
            <LogOut size={20} />
            Deconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 pt-[60px] lg:pt-0 p-4 sm:p-6 lg:p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
