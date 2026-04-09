'use client'

import { useState, useEffect, Fragment } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Loader2,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  Package,
  FileDown,
} from 'lucide-react'

type OrderStatus = 'processing' | 'ordered' | 'shipped' | 'awaiting_bc' | 'partially_delivered' | 'delivered' | 'invoiced' | 'cancelled'
type FilterTab = 'all' | 'processing' | 'delivered' | 'invoiced'

interface OrderItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
}

interface Supplier {
  name: string
}

interface SupplierOrder {
  id: string
  supplier_id: string
  bdc_number: string | null
  status: string
  payment_terms: string | null
  suppliers: Supplier | null
}

interface Quote {
  entity: string
  contact_name: string
  email: string
}

interface Order {
  id: string
  order_number: string
  status: OrderStatus
  source?: string | null
  total_ttc: number | null
  created_at: string
  bc_file_url?: string | null
  delivery_address?: string | null
  delivery_postal_code?: string | null
  delivery_city?: string | null
  quotes: Quote | null
  order_items: OrderItem[]
  supplier_orders: SupplierOrder[]
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  processing: { label: 'En cours', className: 'bg-blue-100 text-blue-700' },
  ordered: { label: 'Commande validée', className: 'bg-indigo-100 text-indigo-700' },
  shipped: { label: 'Expediee', className: 'bg-cyan-100 text-cyan-700' },
  awaiting_bc: { label: 'En attente BC', className: 'bg-amber-100 text-amber-700' },
  partially_delivered: { label: 'Partiellement livree', className: 'bg-yellow-100 text-yellow-700' },
  delivered: { label: 'Livree', className: 'bg-green-100 text-green-700' },
  invoiced: { label: 'Facturee', className: 'bg-purple-100 text-purple-700' },
  cancelled: { label: 'Annulee', className: 'bg-red-100 text-red-700' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return '--'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function GerantCommandesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, source, total_ttc, created_at,
        bc_file_url, delivery_address, delivery_postal_code, delivery_city,
        order_items(*),
        quotes(entity, contact_name, email),
        supplier_orders(id, supplier_id, bdc_number, status, payment_terms, suppliers(name))
      `)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else if (data) {
      setOrders(data as unknown as Order[])
    }
    setLoading(false)
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const isInProgress = (status: OrderStatus) =>
    status === 'processing' ||
    status === 'ordered' ||
    status === 'shipped' ||
    status === 'awaiting_bc' ||
    status === 'partially_delivered'

  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'processing') return isInProgress(o.status)
    if (activeTab === 'delivered') return o.status === 'delivered'
    if (activeTab === 'invoiced') return o.status === 'invoiced'
    return true
  })

  const processingCount = orders.filter((o) => isInProgress(o.status)).length
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length
  const invoicedCount = orders.filter((o) => o.status === 'invoiced').length

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Toutes', count: orders.length },
    { key: 'processing', label: 'En cours', count: processingCount },
    { key: 'delivered', label: 'Livrees', count: deliveredCount },
    { key: 'invoiced', label: 'Facturees', count: invoicedCount },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Commandes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivi des commandes (lecture seule)
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[20px] ${
                  activeTab === tab.key
                    ? tab.key === 'processing'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" />
          Chargement...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
          {activeTab === 'processing'
            ? 'Aucune commande en cours.'
            : activeTab === 'delivered'
            ? 'Aucune commande livree.'
            : activeTab === 'invoiced'
            ? 'Aucune commande facturee.'
            : 'Aucune commande enregistree.'}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {filteredOrders.length} commande{filteredOrders.length > 1 ? 's' : ''}
          </p>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold w-8"></th>
                    <th className="text-left px-4 py-3 font-semibold">N. Commande</th>
                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Client</th>
                    <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Date</th>
                    <th className="text-center px-4 py-3 font-semibold">Statut</th>
                    <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Total TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const isExpanded = expandedId === order.id
                    const statusConfig = STATUS_CONFIG[order.status] ?? {
                      label: order.status,
                      className: 'bg-muted text-muted-foreground',
                    }

                    return (
                      <Fragment key={order.id}>
                        <tr
                          className="border-b border-border/50 hover:bg-muted/10 transition-colors cursor-pointer"
                          onClick={() => toggleExpand(order.id)}
                        >
                          <td className="px-4 py-3">
                            <span className="flex items-center justify-center text-muted-foreground">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono font-medium text-xs">
                              {order.order_number}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-muted-foreground flex-shrink-0" />
                              <span className="font-medium">
                                {order.quotes?.entity ?? (
                                  <span className="text-muted-foreground italic">Inconnu</span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={12} />
                              {formatDate(order.created_at)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusConfig.className}`}
                            >
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-right font-medium">
                            {formatCurrency(order.total_ttc)}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="border-b border-border/50 bg-muted/5">
                            <td colSpan={6} className="px-4 py-5">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Order items */}
                                <div>
                                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                    <Package size={14} className="text-muted-foreground" />
                                    Articles commandes ({order.order_items?.length ?? 0})
                                  </h3>
                                  {order.order_items && order.order_items.length > 0 ? (
                                    <div className="border border-border/50 rounded-lg overflow-hidden">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="bg-muted/20 border-b border-border/50">
                                            <th className="text-left px-3 py-2 font-medium text-xs">Produit</th>
                                            <th className="text-right px-3 py-2 font-medium text-xs w-16">Qte</th>
                                            <th className="text-right px-3 py-2 font-medium text-xs w-24">P.U. HT</th>
                                            <th className="text-right px-3 py-2 font-medium text-xs w-24">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {order.order_items.map((item) => (
                                            <tr key={item.id} className="border-b border-border/30 last:border-0">
                                              <td className="px-3 py-2 text-sm">{item.product_name}</td>
                                              <td className="px-3 py-2 text-right font-semibold">{item.quantity}</td>
                                              <td className="px-3 py-2 text-right text-muted-foreground">
                                                {formatCurrency(Number(item.unit_price))}
                                              </td>
                                              <td className="px-3 py-2 text-right font-medium">
                                                {formatCurrency(Number(item.unit_price) * item.quantity)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Aucun article.</p>
                                  )}
                                </div>

                                {/* Supplier orders + delivery info */}
                                <div>
                                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                    <ShoppingCart size={14} className="text-muted-foreground" />
                                    Commandes fournisseurs ({order.supplier_orders?.length ?? 0})
                                  </h3>
                                  {order.supplier_orders && order.supplier_orders.length > 0 ? (
                                    <div className="space-y-2">
                                      {order.supplier_orders.map((so) => (
                                        <div
                                          key={so.id}
                                          className="flex items-center justify-between rounded-lg border border-border/50 bg-background px-3 py-2.5"
                                        >
                                          <div className="space-y-0.5">
                                            <p className="text-sm font-medium">
                                              {so.suppliers?.name ?? 'Fournisseur inconnu'}
                                            </p>
                                            {so.bdc_number && (
                                              <p className="text-xs text-muted-foreground font-mono">
                                                BDC {so.bdc_number}
                                              </p>
                                            )}
                                          </div>
                                          <span
                                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                              so.status === 'awaiting_payment'
                                                ? 'bg-amber-100 text-amber-700'
                                                : so.status === 'paid'
                                                ? 'bg-green-100 text-green-700'
                                                : so.status === 'delivered'
                                                ? 'bg-blue-100 text-blue-700'
                                                : so.status === 'sent'
                                                ? 'bg-blue-100 text-blue-700'
                                                : so.status === 'proforma_sent'
                                                ? 'bg-orange-100 text-orange-700'
                                                : so.status === 'shipped'
                                                ? 'bg-cyan-100 text-cyan-700'
                                                : 'bg-muted text-muted-foreground'
                                            }`}
                                          >
                                            {so.status === 'awaiting_payment'
                                              ? 'A payer'
                                              : so.status === 'paid'
                                              ? 'Paye'
                                              : so.status === 'delivered'
                                              ? 'Livre'
                                              : so.status === 'sent'
                                              ? 'Commande'
                                              : so.status === 'proforma_sent'
                                              ? 'Proforma envoyee'
                                              : so.status === 'shipped'
                                              ? 'Expedie'
                                              : so.status}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">
                                      Aucune commande fournisseur.
                                    </p>
                                  )}

                                  {order.bc_file_url && (
                                    <div className="mt-4">
                                      <a
                                        href={order.bc_file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
                                      >
                                        <FileDown size={14} />
                                        Bon de commande client
                                      </a>
                                    </div>
                                  )}

                                  {(order.delivery_address || order.delivery_city) && (
                                    <div className="mt-4 rounded-lg border border-border/50 bg-background px-3 py-2.5 text-sm space-y-0.5">
                                      <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-1">
                                        Adresse de livraison
                                      </p>
                                      {order.delivery_address && <p>{order.delivery_address}</p>}
                                      {(order.delivery_postal_code || order.delivery_city) && (
                                        <p>
                                          {[order.delivery_postal_code, order.delivery_city]
                                            .filter(Boolean)
                                            .join(' ')}
                                        </p>
                                      )}
                                    </div>
                                  )}
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
