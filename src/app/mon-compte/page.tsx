'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  FileText,
  ShoppingCart,
  Receipt,
  Clock,
  ArrowRight,
  PlusCircle,
} from 'lucide-react'
import type { Quote } from '@/lib/supabase/types'
import { STATUS_CONFIG, formatDate } from '@/lib/quote-utils'

interface ClientStats {
  devisEnCours: number
  commandesEnCours: number
  facturesDisponibles: number
}

export default function MonCompteDashboard() {
  const [stats, setStats] = useState<ClientStats>({
    devisEnCours: 0,
    commandesEnCours: 0,
    facturesDisponibles: 0,
  })
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createBrowserClient()

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        setLoading(false)
        return
      }

      const userEmail = session.user.email
      const userId = session.user.id

      const [devisEnCoursRes, commandesEnCoursRes, facturesRes, recentRes] =
        await Promise.all([
          supabase
            .from('quotes')
            .select('*', { count: 'exact', head: true })
            .eq('email', userEmail)
            .in('status', ['pending', 'sent']),
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'processing'),
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'invoiced'),
          supabase
            .from('quotes')
            .select('*')
            .eq('email', userEmail)
            .order('created_at', { ascending: false })
            .limit(5),
        ])

      setStats({
        devisEnCours: devisEnCoursRes.count ?? 0,
        commandesEnCours: commandesEnCoursRes.count ?? 0,
        facturesDisponibles: facturesRes.count ?? 0,
      })

      setRecentQuotes((recentRes.data as Quote[]) ?? [])
      setLoading(false)
    }

    fetchData()
  }, [])

  const statCards = [
    {
      label: 'Devis en cours',
      value: stats.devisEnCours,
      icon: FileText,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Commandes en cours',
      value: stats.commandesEnCours,
      icon: ShoppingCart,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Factures disponibles',
      value: stats.facturesDisponibles,
      icon: Receipt,
      color: 'bg-green-50 text-green-600',
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl tracking-tight">Tableau de bord</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card rounded-xl border border-border/60 p-6 animate-pulse"
            >
              <div className="h-10 w-10 bg-muted rounded-xl mb-4" />
              <div className="h-4 w-24 bg-muted rounded mb-2" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-3xl tracking-tight">Tableau de bord</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-card rounded-xl border border-border/60 p-6 shadow-sm"
            >
              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${card.color} mb-4`}
              >
                <Icon size={20} />
              </div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-3xl font-bold tracking-tight mt-1">
                {card.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link
          href="/mon-compte/devis"
          className="flex items-center gap-4 bg-card rounded-xl border border-border/60 p-6 shadow-sm hover:border-primary/40 transition-colors group"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600">
            <FileText size={20} />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Voir mes devis</p>
            <p className="text-sm text-muted-foreground">
              Suivre mes demandes de devis
            </p>
          </div>
          <ArrowRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
        <Link
          href="/devis"
          className="flex items-center gap-4 bg-primary text-primary-foreground rounded-xl p-6 shadow-sm hover:opacity-90 transition-opacity group"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/15">
            <PlusCircle size={20} />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Demander un devis</p>
            <p className="text-sm text-primary-foreground/70">
              Cr&eacute;er une nouvelle demande
            </p>
          </div>
          <ArrowRight size={16} className="opacity-60 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Recent activity */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm">
        <div className="px-6 py-5 border-b border-border/60">
          <h2 className="font-heading text-xl tracking-tight flex items-center gap-2">
            <Clock size={20} className="text-muted-foreground" />
            Activit&eacute; r&eacute;cente
          </h2>
        </div>

        {recentQuotes.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aucune activit&eacute; pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Entit&eacute;</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Statut</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.map((quote) => {
                  const status = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.pending
                  return (
                    <tr
                      key={quote.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium">{quote.entity}</td>
                      <td className="px-6 py-4">{quote.contact_name}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.className}`}
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
