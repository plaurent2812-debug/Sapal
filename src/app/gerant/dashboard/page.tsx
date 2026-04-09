'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  BarChart3,
  FileText,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  Calendar,
  Loader2,
} from 'lucide-react'

interface DashboardStats {
  caMonth: number
  pendingQuotes: number
  activeOrders: number
  pendingPayments: number
}

interface ClientOption {
  user_id: string
  entity: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return options
}

export default function GerantDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    caMonth: 0,
    pendingQuotes: 0,
    activeOrders: 0,
    pendingPayments: 0,
  })
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const monthOptions = getMonthOptions()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createBrowserClient()

    // Parse selected month
    const [year, month] = selectedMonth.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1).toISOString()
    const endDate = new Date(year, month, 1).toISOString()

    // Fetch CA: orders with status delivered or invoiced in the selected month
    let caQuery = supabase
      .from('orders')
      .select('total_ht, user_id')
      .in('status', ['delivered', 'invoiced'])
      .gte('created_at', startDate)
      .lt('created_at', endDate)

    if (selectedClient !== 'all') {
      caQuery = caQuery.eq('user_id', selectedClient)
    }

    const { data: caOrders } = await caQuery

    const caMonth = (caOrders ?? []).reduce(
      (sum: number, o: { total_ht: number }) => sum + (o.total_ht ?? 0),
      0
    )

    // Fetch pending quotes count
    const { count: pendingQuotes } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    // Fetch active orders count (processing, ordered, shipped, awaiting_bc, partially_delivered)
    const { count: activeOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['processing', 'ordered', 'shipped', 'awaiting_bc', 'partially_delivered'])

    // Fetch pending payments count
    const { count: pendingPayments } = await supabase
      .from('supplier_orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['proforma_sent', 'awaiting_payment'])

    setStats({
      caMonth,
      pendingQuotes: pendingQuotes ?? 0,
      activeOrders: activeOrders ?? 0,
      pendingPayments: pendingPayments ?? 0,
    })
    setLoading(false)
  }, [selectedMonth, selectedClient])

  // Fetch unique clients for the dropdown
  useEffect(() => {
    const fetchClients = async () => {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('orders')
        .select('user_id, quotes(entity)')

      if (data) {
        const seen = new Map<string, string>()
        for (const row of data as unknown as { user_id: string; quotes: { entity: string } | null }[]) {
          if (row.user_id && row.quotes?.entity && !seen.has(row.user_id)) {
            seen.set(row.user_id, row.quotes.entity)
          }
        }
        const clientList: ClientOption[] = []
        for (const [user_id, entity] of seen) {
          clientList.push({ user_id, entity })
        }
        clientList.sort((a, b) => a.entity.localeCompare(b.entity))
        setClients(clientList)
      }
    }
    fetchClients()
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const statCards = [
    {
      label: 'CA du mois',
      value: formatCurrency(stats.caMonth),
      icon: TrendingUp,
      color: 'bg-green-50 text-green-600',
      href: '/gerant/commandes',
    },
    {
      label: 'Devis en attente',
      value: stats.pendingQuotes.toString(),
      icon: FileText,
      color: 'bg-yellow-50 text-yellow-600',
      href: '/gerant/devis',
    },
    {
      label: 'Commandes en cours',
      value: stats.activeOrders.toString(),
      icon: ShoppingCart,
      color: 'bg-blue-50 text-blue-600',
      href: '/gerant/commandes',
    },
    {
      label: 'Prepaiements a regler',
      value: stats.pendingPayments.toString(),
      icon: CreditCard,
      color: 'bg-orange-50 text-orange-600',
      href: '/gerant/prepaiements',
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-heading text-3xl tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Vue d&apos;ensemble</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-muted-foreground" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.user_id} value={c.user_id}>
                {c.entity}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" />
          Chargement...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.label}
                href={card.href}
                className="bg-card rounded-xl border border-border/60 p-6 shadow-sm hover:border-primary/40 hover:shadow-md transition-all group"
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
      )}
    </div>
  )
}
