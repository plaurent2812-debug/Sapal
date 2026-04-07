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
  Upload,
  MapPin,
  CheckCircle2,
} from 'lucide-react'
import { formatDate } from '@/lib/quote-utils'

type OrderStatus = 'processing' | 'partially_delivered' | 'delivered' | 'invoiced' | 'cancelled' | 'awaiting_bc'

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
  bc_file_url: string | null
  delivery_address: string | null
  delivery_postal_code: string | null
  delivery_city: string | null
  order_items: OrderItem[]
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  awaiting_bc: {
    label: 'En attente de votre BC',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
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

  // BC upload state
  const [bcFile, setBcFile] = useState<File | null>(null)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryPostalCode, setDeliveryPostalCode] = useState('')
  const [deliveryCity, setDeliveryCity] = useState('')
  const [uploadingBcOrderId, setUploadingBcOrderId] = useState<string | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [bcUploadError, setBcUploadError] = useState<string | null>(null)
  const [bcUploadSuccess, setBcUploadSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchMyOrders()
    loadDeliveryProfile()
  }, [])

  async function loadDeliveryProfile() {
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('client_profiles')
          .select('address, postal_code, city')
          .eq('user_id', session.user.id)
          .single()
        if (profile) {
          if (profile.address) setDeliveryAddress(profile.address)
          if (profile.postal_code) setDeliveryPostalCode(profile.postal_code)
          if (profile.city) setDeliveryCity(profile.city)
        }
      }
    } catch {
      // non-blocking — silently ignore
    } finally {
      setProfileLoaded(true)
    }
  }

  async function fetchMyOrders() {
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, total_ttc, created_at, estimated_delivery, bc_file_url, delivery_address, delivery_postal_code, delivery_city, order_items(id, product_name, variant_label, quantity, unit_price)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setOrders(data as unknown as Order[])
    }

    setLoading(false)
  }

  async function handleUploadBC(orderId: string) {
    setBcUploadError(null)
    setBcUploadSuccess(null)

    if (!bcFile) {
      setBcUploadError('Veuillez sélectionner un fichier BC.')
      return
    }
    if (!deliveryAddress.trim()) {
      setBcUploadError("Veuillez renseigner l'adresse de livraison.")
      return
    }
    if (!deliveryPostalCode.trim()) {
      setBcUploadError('Veuillez renseigner le code postal.')
      return
    }
    if (!deliveryCity.trim()) {
      setBcUploadError('Veuillez renseigner la ville.')
      return
    }

    setUploadingBcOrderId(orderId)

    try {
      const formData = new FormData()
      formData.append('bc_file', bcFile)
      formData.append('delivery_address', deliveryAddress.trim())
      formData.append('delivery_postal_code', deliveryPostalCode.trim())
      formData.append('delivery_city', deliveryCity.trim())

      const response = await fetch(`/api/orders/${orderId}/upload-bc`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Une erreur est survenue lors de l\'envoi.')
      }

      setBcUploadSuccess('Votre bon de commande a bien été envoyé.')
      setBcFile(null)
      await fetchMyOrders()
    } catch (err) {
      setBcUploadError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setUploadingBcOrderId(null)
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
    // Reset upload feedback when switching rows
    setBcUploadError(null)
    setBcUploadSuccess(null)
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
                    const isAwaitingBC = order.status === 'awaiting_bc'
                    const isUploadingThisOrder = uploadingBcOrderId === order.id

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

                              {/* BC upload form — only shown when status is awaiting_bc */}
                              {isAwaitingBC && (
                                <div className="mt-6 border-t border-amber-200 pt-6">
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                                    <h3 className="font-semibold text-sm text-amber-900 mb-1 flex items-center gap-2">
                                      <Upload size={15} className="text-amber-700" />
                                      Transmettre votre bon de commande
                                    </h3>
                                    <p className="text-xs text-amber-800 mb-4">
                                      Pour finaliser cette commande, veuillez joindre votre bon de commande (BC) et confirmer l&apos;adresse de livraison.
                                    </p>

                                    <div className="space-y-4" key={profileLoaded ? 'loaded' : 'loading'}>
                                      {/* File input */}
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                                          <FileText size={13} />
                                          Bon de commande <span className="text-red-600">*</span>
                                        </label>
                                        <input
                                          type="file"
                                          accept=".pdf,.jpg,.jpeg,.png"
                                          onChange={(e) => setBcFile(e.target.files?.[0] ?? null)}
                                          className="w-full text-sm text-amber-900 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer bg-white border border-amber-200 rounded-lg px-3 py-2 transition-colors"
                                        />
                                        <p className="text-xs text-amber-700">Formats acceptés : PDF, JPEG, PNG</p>
                                      </div>

                                      {/* Delivery address */}
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                                          <MapPin size={13} />
                                          Adresse de livraison <span className="text-red-600">*</span>
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="Adresse"
                                          value={deliveryAddress}
                                          onChange={(e) => setDeliveryAddress(e.target.value)}
                                          className="w-full text-sm bg-white border border-amber-200 rounded-lg px-3 py-2 placeholder:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors"
                                        />
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                          <label className="text-xs font-semibold text-amber-900">
                                            Code postal <span className="text-red-600">*</span>
                                          </label>
                                          <input
                                            type="text"
                                            placeholder="Ex: 06400"
                                            value={deliveryPostalCode}
                                            onChange={(e) => setDeliveryPostalCode(e.target.value)}
                                            className="w-full text-sm bg-white border border-amber-200 rounded-lg px-3 py-2 placeholder:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors"
                                          />
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className="text-xs font-semibold text-amber-900">
                                            Ville <span className="text-red-600">*</span>
                                          </label>
                                          <input
                                            type="text"
                                            placeholder="Ex: Cannes"
                                            value={deliveryCity}
                                            onChange={(e) => setDeliveryCity(e.target.value)}
                                            className="w-full text-sm bg-white border border-amber-200 rounded-lg px-3 py-2 placeholder:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors"
                                          />
                                        </div>
                                      </div>

                                      {/* Feedback messages */}
                                      {bcUploadError && expandedId === order.id && (
                                        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                          {bcUploadError}
                                        </p>
                                      )}
                                      {bcUploadSuccess && expandedId === order.id && (
                                        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                                          <CheckCircle2 size={13} />
                                          {bcUploadSuccess}
                                        </p>
                                      )}

                                      {/* Submit button */}
                                      <button
                                        type="button"
                                        onClick={() => handleUploadBC(order.id)}
                                        disabled={isUploadingThisOrder}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                      >
                                        {isUploadingThisOrder ? (
                                          <>
                                            <Loader2 size={15} className="animate-spin" />
                                            Envoi en cours...
                                          </>
                                        ) : (
                                          <>
                                            <Upload size={15} />
                                            Valider et envoyer ma commande
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
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
