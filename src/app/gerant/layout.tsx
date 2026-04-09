'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  FileText,
  LogOut,
  ShoppingCart,
  Receipt,
  CreditCard,
  ArrowLeft,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const gerantNavItems: NavItem[] = [
  { href: '/gerant/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/gerant/devis', label: 'Devis', icon: FileText },
  { href: '/gerant/commandes', label: 'Commandes', icon: ShoppingCart },
  { href: '/gerant/factures', label: 'Factures', icon: Receipt },
  { href: '/gerant/prepaiements', label: 'Prepaiements', icon: CreditCard },
]

export default function GerantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [userEmail, setUserEmail] = useState<string>('')
  const [prepaymentCount, setPrepaymentCount] = useState(0)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/connexion')
      } else {
        const role = session.user.user_metadata?.role
        if (role !== 'gerant') {
          router.push(role === 'admin' ? '/admin' : '/connexion')
        } else {
          setAuthenticated(true)
          setUserEmail(session.user.email ?? '')
          // Fetch prepayment count
          supabase
            .from('supplier_orders')
            .select('id', { count: 'exact', head: true })
            .in('status', ['proforma_sent', 'awaiting_payment'])
            .then(({ count }) => setPrepaymentCount(count ?? 0))
        }
      }
      setChecking(false)
    })
  }, [router])

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
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-primary flex flex-col z-50">
        {/* Logo / Brand */}
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xl text-white tracking-tight">
              SAPAL
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/15 text-white/80 text-xs font-medium">
              Gerant
            </span>
          </div>
          <p className="text-white/40 text-xs mt-1">Espace gerant</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {gerantNavItems.map((item) => {
            const isActive =
              item.href === '/gerant/dashboard'
                ? pathname === '/gerant' || pathname === '/gerant/dashboard'
                : pathname.startsWith(item.href)
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
                {item.href === '/gerant/prepaiements' && prepaymentCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                    {prepaymentCount}
                  </span>
                )}
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
