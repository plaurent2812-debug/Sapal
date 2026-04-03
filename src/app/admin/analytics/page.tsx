'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Loader2,
  BarChart3,
  TrendingUp,
  DollarSign,
  UserPlus,
  ExternalLink,
} from 'lucide-react'

interface MonthlyStats {
  quotesThisMonth: number
  ordersThisMonth: number
  revenueThisMonth: number
  newClientsThisMonth: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

function getFirstDayOfMonth(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

function getCurrentMonthLabel(): string {
  return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<MonthlyStats>({
    quotesThisMonth: 0,
    ordersThisMonth: 0,
    revenueThisMonth: 0,
    newClientsThisMonth: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const monthStart = getFirstDayOfMonth()
  const monthLabel = getCurrentMonthLabel()

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      setError(null)
      const supabase = createBrowserClient()

      const [quotesRes, ordersRes, revenueRes, clientsRes] = await Promise.all([
        supabase
          .from('quotes')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart),
        supabase
          .from('orders')
          .select('total_ht')
          .gte('created_at', monthStart),
        supabase
          .from('client_profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart),
      ])

      if (quotesRes.error || ordersRes.error || revenueRes.error || clientsRes.error) {
        setError('Erreur lors du chargement des statistiques.')
        setLoading(false)
        return
      }

      const revenueTotal = (revenueRes.data ?? []).reduce(
        (sum, row) => sum + (row.total_ht ?? 0),
        0
      )

      setStats({
        quotesThisMonth: quotesRes.count ?? 0,
        ordersThisMonth: ordersRes.count ?? 0,
        revenueThisMonth: revenueTotal,
        newClientsThisMonth: clientsRes.count ?? 0,
      })
      setLoading(false)
    }

    fetchStats()
  }, [monthStart])

  const statCards = [
    {
      label: 'Total devis ce mois',
      value: stats.quotesThisMonth,
      display: String(stats.quotesThisMonth),
      icon: BarChart3,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Total commandes ce mois',
      value: stats.ordersThisMonth,
      display: String(stats.ordersThisMonth),
      icon: TrendingUp,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'CA HT ce mois',
      value: stats.revenueThisMonth,
      display: formatCurrency(stats.revenueThisMonth),
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Nouveaux clients ce mois',
      value: stats.newClientsThisMonth,
      display: String(stats.newClientsThisMonth),
      icon: UserPlus,
      color: 'bg-orange-50 text-orange-600',
    },
  ]

  const externalLinks = [
    {
      label: 'Voir le trafic du site',
      description: 'Visites, pages vues et sources de trafic via Vercel Analytics',
      href: 'https://vercel.com/plaurent2812-debug/sapal-site/analytics',
      color: 'bg-sky-50 text-sky-600',
    },
    {
      label: 'Voir Speed Insights',
      description: 'Core Web Vitals et performances de chargement des pages',
      href: 'https://vercel.com/plaurent2812-debug/sapal-site/speed-insights',
      color: 'bg-violet-50 text-violet-600',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">Analytics & Performance</h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">{monthLabel}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Monthly stats */}
      <div>
        <h2 className="font-heading text-lg tracking-tight mb-4">Activite du mois</h2>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border/60 p-5 animate-pulse"
              >
                <div className="h-10 w-10 bg-muted rounded-xl mb-3" />
                <div className="h-3 w-24 bg-muted rounded mb-2" />
                <div className="h-7 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon
              return (
                <div
                  key={card.label}
                  className="bg-card rounded-xl border border-border/60 p-5 shadow-sm"
                >
                  <div
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${card.color} mb-3`}
                  >
                    <Icon size={20} />
                  </div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold tracking-tight mt-0.5">{card.display}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Vercel links */}
      <div>
        <h2 className="font-heading text-lg tracking-tight mb-4">Tableau de bord Vercel</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {externalLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-card rounded-xl border border-border/60 p-6 shadow-sm hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${link.color} flex-shrink-0`}
              >
                <ExternalLink size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{link.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{link.description}</p>
              </div>
              <ExternalLink
                size={16}
                className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
