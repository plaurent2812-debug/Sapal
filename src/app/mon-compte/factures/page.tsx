'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Receipt,
  Loader2,
  Calendar,
  Download,
  ExternalLink,
} from 'lucide-react'
import { formatDate } from '@/lib/quote-utils'

interface InvoicedOrder {
  id: string
  order_number: string
  total_ttc: number | null
  invoiced_at: string | null
  invoice_url: string | null
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return '\u2014'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function MonCompteFacturesPage() {
  const [invoices, setInvoices] = useState<InvoicedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    fetchMyInvoices()
  }, [])

  async function fetchMyInvoices() {
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, total_ttc, invoiced_at, invoice_url')
      .eq('user_id', session.user.id)
      .eq('status', 'invoiced')
      .order('invoiced_at', { ascending: false })

    if (!error && data) {
      setInvoices(data as InvoicedOrder[])
    }

    setLoading(false)
  }

  async function handleDownload(invoice: InvoicedOrder) {
    if (invoice.invoice_url) {
      window.open(invoice.invoice_url, '_blank', 'noopener,noreferrer')
      return
    }

    setDownloadingId(invoice.id)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Erreur lors du t\u00e9l\u00e9chargement')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="font-heading text-2xl sm:text-3xl tracking-tight">Mes Factures</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" />
          Chargement...
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Receipt size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucune facture disponible pour le moment.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {invoices.length} facture{invoices.length > 1 ? 's' : ''}
          </p>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold">N&deg; Commande</th>
                    <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Date facturation</th>
                    <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">Total TTC</th>
                    <th className="text-center px-4 py-3 font-semibold w-36">T&eacute;l&eacute;charger</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const isDownloading = downloadingId === invoice.id
                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-border/50 hover:bg-muted/10 transition-colors last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono font-medium text-xs">{invoice.order_number}</span>
                            <span className="text-muted-foreground text-xs sm:hidden">
                              {invoice.invoiced_at ? formatDate(invoice.invoiced_at) : '\u2014'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {invoice.invoiced_at ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar size={14} className="flex-shrink-0" />
                              <span>{formatDate(invoice.invoiced_at)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">\u2014</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium hidden md:table-cell">
                          {formatCurrency(invoice.total_ttc)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            disabled={isDownloading}
                            onClick={() => handleDownload(invoice)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isDownloading ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : invoice.invoice_url ? (
                              <ExternalLink size={13} />
                            ) : (
                              <Download size={13} />
                            )}
                            PDF
                          </button>
                        </td>
                      </tr>
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
