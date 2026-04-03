'use client'

import { useEffect, useState, Fragment } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  ShoppingCart,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  Package,
  FileText,
} from 'lucide-react'
import { formatDate } from '@/lib/quote-utils'

type OrderStatus = 'processing' | 'partially_delivered' | 'delivered' | 'invoiced' | 'cancelled'

interface OrderItem {
  id: string
  product_name: string
  variant_label: string | null
  quantity: number
  unit_price: number
}

interface Order {
  id: string
  order_number: string
  status: OrderStatus
  total_ttc: number | null
  created_at: string
  estimated_delivery: string | null
  order_items: OrderItem[]
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  processing: {
    label: 'En cours de traitement',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  partially_delivered: {
    label: 'Livraison partielle',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  delivered: {
    label: 'Livr\u00e9e',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  invoiced: {
    label: 'Factur\u00e9e',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  cancelled: {
    label: 'Annul\u00e9e',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return '\u2014'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function MonCompteCommandesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchMyOrders()
  }, [])

  async function fetchMyOrders() {
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, total_ttc, created_at, estimated_delivery, order_items(id, product_name, variant_label, quantity, unit_price)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setOrders(data as unknown as Order[])
    }

    setLoading(false)
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Mes Commandes</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" />
          Chargement...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm mb-1">Vous n&apos;avez pas encore de commandes.</p>
          <p className="text-sm mb-4">
            Vos commandes appara&icirc;tront ici une fois vos devis accept&eacute;s.
          </p>
          <Link
            href="/mon-compte/devis"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted/30 transition-colors"
          >
            <FileText size={16} />
            Voir mes devis
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {orders.length} commande{orders.length > 1 ? 's' : ''}
          </p>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold w-8"></th>
                    <th className="text-left px-4 py-3 font-semibold">N&deg; Commande</th>
                    <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Date</th>
                    <th className="text-center px-4 py-3 font-semibold">Statut</th>
                    <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">Total TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const isExpanded = expandedId === order.id
                    const statusConfig = ORDER_STATUS_CONFIG[order.status] ?? {
                      label: order.status,
                      className: 'bg-muted text-muted-foreground border-border',
                    }
                    const itemCount = order.order_items?.length ?? 0

                    return (
                      <Fragment key={order.id}>
                        <tr
                          className="border-b border-border/50 hover:bg-muted/10 transition-colors cursor-pointer"
                          onClick={() => toggleExpand(order.id)}
                        >
                          <td className="px-4 py-3">
                            <button
                              className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted/40 transition-colors"
                              onClick={(e) => { e.stopPropagation(); toggleExpand(order.id) }}
                              aria-label={isExpanded ? 'Replier' : 'D\u00e9tailler'}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono font-medium text-xs">
                              {order.order_number}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar size={14} className="flex-shrink-0" />
                              <span>{formatDate(order.created_at)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.className}`}
                            >
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium hidden md:table-cell">
                            {formatCurrency(order.total_ttc)}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="border-b border-border/50 bg-muted/5">
                            <td colSpan={5} className="px-4 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Order items */}
                                <div>
                                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                    <Package size={14} className="text-muted-foreground" />
                                    Articles command&eacute;s ({itemCount})
                                  </h3>
                                  {itemCount > 0 ? (
                                    <div className="border border-border/50 rounded-lg overflow-hidden">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="bg-muted/20 border-b border-border/50">
                                            <th className="text-left px-3 py-2 font-medium text-xs">Produit</th>
                                            <th className="text-right px-3 py-2 font-medium text-xs w-12">Qt&eacute;</th>
                                            <th className="text-right px-3 py-2 font-medium text-xs w-24 hidden sm:table-cell">P.U. HT</th>
                                            <th className="text-right px-3 py-2 font-medium text-xs w-24">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {order.order_items.map((item) => {
                                            const lineTotal = item.quantity * item.unit_price
                                            return (
                                              <tr key={item.id} className="border-b border-border/30 last:border-0">
                                                <td className="px-3 py-2 text-sm">
                                                  <span>{item.product_name}</span>
                                                  {item.variant_label && (
                                                    <span className="block text-xs text-muted-foreground">
                                                      {item.variant_label}
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold">
                                                  {item.quantity}
                                                </td>
                                                <td className="px-3 py-2 text-right text-muted-foreground hidden sm:table-cell">
                                                  {formatCurrency(item.unit_price)}
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium">
                                                  {formatCurrency(lineTotal)}
                                                </td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Aucun article.</p>
                                  )}
                                </div>

                                {/* Order info */}
                                <div className="space-y-4">
                                  <div className="rounded-lg border border-border/50 bg-background p-4 space-y-3">
                                    <h3 className="font-semibold text-sm">R&eacute;capitulatif</h3>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">N&deg; commande</span>
                                      <span className="font-mono font-medium text-xs">{order.order_number}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">Date</span>
                                      <span>{formatDate(order.created_at)}</span>
                                    </div>
                                    {order.estimated_delivery && (
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Livraison estim&eacute;e</span>
                                        <span className="font-medium">{formatDate(order.estimated_delivery)}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between text-sm border-t border-border/50 pt-3">
                                      <span className="text-muted-foreground">Total TTC</span>
                                      <span className="font-semibold text-base">{formatCurrency(order.total_ttc)}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.className}`}
                                    >
                                      {statusConfig.label}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
