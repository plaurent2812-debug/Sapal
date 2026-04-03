'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { Package, FolderOpen, FileText, Clock, PlusCircle, ArrowRight, User, ClipboardList, Users, UserCheck, ShoppingCart } from 'lucide-react'
import type { Quote } from '@/lib/supabase/types'
import { STATUS_CONFIG, formatDate } from '@/lib/quote-utils'

type UserRole = 'admin' | 'gerant' | 'client'

interface DashboardStats {
  totalProducts: number
  totalCategories: number
  totalQuotes: number
  pendingQuotes: number
  activeClients: number
  pendingClients: number
  processingOrders: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalCategories: 0,
    totalQuotes: 0,
    pendingQuotes: 0,
    activeClients: 0,
    pendingClients: 0,
    processingOrders: 0,
  })
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<UserRole>('client')

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createBrowserClient()

      // Get the user role from session metadata
      const { data: { session } } = await supabase.auth.getSession()
      const userRole = (session?.user?.user_metadata?.role as UserRole) || 'client'
      setRole(userRole)

      const [productsRes, categoriesRes, quotesRes, pendingRes, recentRes, activeClientsRes, pendingClientsRes, processingOrdersRes] =
        await Promise.all([
          supabase.from('products').select('*', { count: 'exact', head: true }),
          supabase.from('categories').select('*', { count: 'exact', head: true }),
          supabase.from('quotes').select('*', { count: 'exact', head: true }),
          supabase
            .from('quotes')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('quotes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('client_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('account_status', 'active'),
          supabase
            .from('client_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('account_status', 'pending'),
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'processing'),
        ])

      setStats({
        totalProducts: productsRes.count ?? 0,
        totalCategories: categoriesRes.count ?? 0,
        totalQuotes: quotesRes.count ?? 0,
        pendingQuotes: pendingRes.count ?? 0,
        activeClients: activeClientsRes.count ?? 0,
        pendingClients: pendingClientsRes.count ?? 0,
        processingOrders: processingOrdersRes.count ?? 0,
      })

      setRecentQuotes((recentRes.data as Quote[]) ?? [])
      setLoading(false)
    }

    fetchData()
  }, [])

  const statCards = [
    {
      label: 'Total produits',
      value: stats.totalProducts,
      icon: Package,
      color: 'bg-blue-50 text-blue-600',
      href: '/admin/produits',
    },
    {
      label: 'Total categories',
      value: stats.totalCategories,
      icon: FolderOpen,
      color: 'bg-purple-50 text-purple-600',
      href: '/admin/categories',
    },
    {
      label: 'Devis recus',
      value: stats.totalQuotes,
      icon: FileText,
      color: 'bg-green-50 text-green-600',
      href: '/admin/devis',
    },
    {
      label: 'Devis en attente',
      value: stats.pendingQuotes,
      icon: Clock,
      color: 'bg-yellow-50 text-yellow-600',
      href: '/admin/devis',
    },
    {
      label: 'Clients actifs',
      value: stats.activeClients,
      icon: UserCheck,
      color: 'bg-emerald-50 text-emerald-600',
      href: '/admin/clients',
    },
    {
      label: 'Clients en attente',
      value: stats.pendingClients,
      icon: Users,
      color: 'bg-orange-50 text-orange-600',
      href: '/admin/clients',
    },
    {
      label: 'Commandes en cours',
      value: stats.processingOrders,
      icon: ShoppingCart,
      color: 'bg-sky-50 text-sky-600',
      href: '/admin/commandes',
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl tracking-tight">Dashboard</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="bg-card rounded-xl border border-border/60 p-5 animate-pulse"
            >
              <div className="h-10 w-10 bg-muted rounded-xl mb-3" />
              <div className="h-3 w-20 bg-muted rounded mb-2" />
              <div className="h-7 w-12 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-3xl tracking-tight">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-card rounded-xl border border-border/60 p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${card.color} mb-3`}
              >
                <Icon size={20} />
              </div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold tracking-tight mt-0.5">
                {card.value}
              </p>
            </Link>
          )
        })}
      </div>

      {/* Role-specific quick actions */}
      {role === 'client' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link
            href="/admin/profil"
            className="flex items-center gap-4 bg-card rounded-xl border border-border/60 p-6 shadow-sm hover:border-primary/40 transition-colors group"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-50 text-purple-600">
              <User size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Mon Profil</p>
              <p className="text-sm text-muted-foreground">
                Voir et modifier mes informations
              </p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <Link
            href="/admin/mes-devis"
            className="flex items-center gap-4 bg-card rounded-xl border border-border/60 p-6 shadow-sm hover:border-primary/40 transition-colors group"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600">
              <ClipboardList size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Mes Devis</p>
              <p className="text-sm text-muted-foreground">
                Suivre mes demandes de devis
              </p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <Link
            href="/admin/devis/nouveau"
            className="flex items-center gap-4 bg-primary text-primary-foreground rounded-xl p-6 shadow-sm hover:opacity-90 transition-opacity group"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/15">
              <PlusCircle size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Nouveau Devis</p>
              <p className="text-sm text-primary-foreground/70">
                Creer une demande de devis
              </p>
            </div>
            <ArrowRight size={16} className="opacity-60 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      )}

      {(role === 'admin' || role === 'gerant') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link
            href="/admin/produits"
            className="flex items-center gap-4 bg-card rounded-xl border border-border/60 p-6 shadow-sm hover:border-primary/40 transition-colors group"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600">
              <Package size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Gerer les produits</p>
              <p className="text-sm text-muted-foreground">
                Ajouter, modifier ou supprimer des produits
              </p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <Link
            href="/admin/categories"
            className="flex items-center gap-4 bg-card rounded-xl border border-border/60 p-6 shadow-sm hover:border-primary/40 transition-colors group"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-50 text-purple-600">
              <FolderOpen size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Gerer les categories</p>
              <p className="text-sm text-muted-foreground">
                Organiser les categories de produits
              </p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <Link
            href="/admin/clients"
            className="flex items-center gap-4 bg-card rounded-xl border border-border/60 p-6 shadow-sm hover:border-primary/40 transition-colors group"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600">
              <Users size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Voir les clients</p>
              <p className="text-sm text-muted-foreground">
                Gerer les comptes clients
              </p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <Link
            href="/admin/commandes"
            className="flex items-center gap-4 bg-card rounded-xl border border-border/60 p-6 shadow-sm hover:border-primary/40 transition-colors group"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-600">
              <ShoppingCart size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Voir les commandes</p>
              <p className="text-sm text-muted-foreground">
                Suivre les commandes en cours
              </p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>
      )}

      {/* Recent quotes */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm">
        <div className="px-6 py-5 border-b border-border/60">
          <h2 className="font-heading text-xl tracking-tight">
            Derniers devis
          </h2>
        </div>

        {recentQuotes.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            Aucun devis pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Collectivite</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Statut</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.map((quote) => {
                  const status =
                    STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.pending
                  return (
                    <tr
                      key={quote.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium">
                        {quote.entity}
                      </td>
                      <td className="px-6 py-4">{quote.contact_name}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {quote.email}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDate(quote.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
