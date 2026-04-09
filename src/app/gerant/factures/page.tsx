'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Loader2,
  FileDown,
  Download,
  Receipt,
  Building2,
  Calendar,
} from 'lucide-react'

interface Quote {
  entity: string
  contact_name: string
  email: string
}

interface InvoicedOrder {
  id: string
  order_number: string
  status: string
  total_ttc: number | null
  invoiced_at: string | null
  invoice_url: string | null
  quotes: Quote | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
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

export default function GerantFacturesPage() {
  const [orders, setOrders] = useState<InvoicedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [downloadingChorusId, setDownloadingChorusId] = useState<string | null>(null)

  useEffect(() => {
    fetchInvoicedOrders()
  }, [])

  async function fetchInvoicedOrders() {
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('*, quotes(entity, contact_name, email)')
      .eq('status', 'invoiced')
      .order('invoiced_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else if (data) {
      setOrders(data as unknown as InvoicedOrder[])
    }
    setLoading(false)
  }

  async function handleDownloadInvoicePDF(orderId: string, orderNumber: string) {
    setDownloadingInvoiceId(orderId)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${orderId}/pdf`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur lors du telechargement')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `facture-${orderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du telechargement de la facture')
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  async function handleDownloadChorusPDF(orderId: string, orderNumber: string) {
    setDownloadingChorusId(orderId)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/chorus-pdf`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur lors du telechargement')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `facture-chorus-${orderNumber.replace(/^CMD-/, 'FAC-')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du telechargement Chorus Pro')
    } finally {
      setDownloadingChorusId(null)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Factures</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Toutes les commandes facturees
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" />
          Chargement...
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Receipt size={32} className="mx-auto mb-2 opacity-40" />
          Aucune facture pour le moment.
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {orders.length} facture{orders.length > 1 ? 's' : ''}
          </p>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold">N. Commande</th>
                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Client</th>
                    <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Date facturation</th>
                    <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Total TTC</th>
                    <th className="text-center px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                    >
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
                          {formatDate(order.invoiced_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-right font-medium">
                        {formatCurrency(order.total_ttc)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <button
                            disabled={downloadingInvoiceId === order.id}
                            onClick={() => handleDownloadInvoicePDF(order.id, order.order_number)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {downloadingInvoiceId === order.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Download size={12} />
                            )}
                            Facture PDF
                          </button>
                          <button
                            disabled={downloadingChorusId === order.id}
                            onClick={() => handleDownloadChorusPDF(order.id, order.order_number)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {downloadingChorusId === order.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <FileDown size={12} />
                            )}
                            Chorus Pro
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
