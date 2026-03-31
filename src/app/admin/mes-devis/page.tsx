'use client'

import { useEffect, useState, Fragment } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Calendar,
  Building2,
  Package,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type QuoteStatus = 'pending' | 'sent' | 'accepted' | 'rejected'

interface QuoteItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
}

interface QuoteWithItems {
  id: string
  entity: string
  contact_name: string
  email: string
  phone: string
  message: string | null
  status: QuoteStatus
  created_at: string
  quote_items: QuoteItem[]
}

const STATUS_CONFIG: Record<QuoteStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  sent: { label: 'En cours', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  accepted: { label: 'Accept\u00e9', className: 'bg-green-100 text-green-800 border-green-200' },
  rejected: { label: 'Refus\u00e9', className: 'bg-red-100 text-red-800 border-red-200' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function MesDevisPage() {
  const [quotes, setQuotes] = useState<QuoteWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMyQuotes() {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user?.email) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('email', session.user.email)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setQuotes(data as unknown as QuoteWithItems[])
      }

      setLoading(false)
    }

    fetchMyQuotes()
  }, [])

  async function handleDownloadPDF(quoteId: string) {
    setDownloadingId(quoteId)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/pdf`)
      if (!res.ok) throw new Error('Erreur téléchargement')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'devis.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erreur lors du téléchargement du PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Mes Devis</h1>
        <Link href="/admin/devis/nouveau">
          <Button>
            <PlusCircle size={16} className="mr-2" />
            Nouveau devis
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" />
          Chargement...
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm mb-4">Vous n&apos;avez pas encore de devis.</p>
          <Link href="/admin/devis/nouveau">
            <Button variant="outline">
              <PlusCircle size={16} className="mr-2" />
              Cr&eacute;er mon premier devis
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {quotes.length} devis
          </p>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold w-8"></th>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Entit&eacute;</th>
                    <th className="text-center px-4 py-3 font-semibold">Produits</th>
                    <th className="text-center px-4 py-3 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => {
                    const isExpanded = expandedId === quote.id
                    const config = STATUS_CONFIG[quote.status]
                    const itemCount = quote.quote_items?.length ?? 0

                    return (
                      <Fragment key={quote.id}>
                        <tr
                          className="border-b border-border/50 hover:bg-muted/10 transition-colors cursor-pointer"
                          onClick={() => toggleExpand(quote.id)}
                        >
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </Button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar size={14} className="flex-shrink-0" />
                              <span>{formatDate(quote.created_at)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-muted-foreground flex-shrink-0" />
                              <span className="font-medium">{quote.entity}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Package size={14} />
                              {itemCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.className}`}
                            >
                              {config.label}
                            </span>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="border-b border-border/50 bg-muted/5">
                            <td colSpan={5} className="px-4 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Quote info */}
                                <div className="space-y-3">
                                  <h3 className="font-semibold text-sm">Informations</h3>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Building2 size={14} />
                                      <span>{quote.entity}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <span className="font-medium text-foreground">{quote.contact_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Calendar size={14} />
                                      <span>{formatDate(quote.created_at)}</span>
                                    </div>
                                  </div>
                                  {quote.message && (
                                    <div className="mt-3">
                                      <p className="text-xs font-semibold text-muted-foreground mb-1">Message :</p>
                                      <p className="text-sm bg-background rounded-lg p-3 border border-border/50">
                                        {quote.message}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Quote items */}
                                <div>
                                  <h3 className="font-semibold text-sm mb-3">
                                    Produits demand&eacute;s ({itemCount})
                                  </h3>
                                  {itemCount > 0 ? (
                                    <div className="border border-border/50 rounded-lg overflow-hidden">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="bg-muted/20 border-b border-border/50">
                                            <th className="text-left px-3 py-2 font-medium text-xs">Produit</th>
                                            <th className="text-right px-3 py-2 font-medium text-xs w-20">Quantit&eacute;</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {quote.quote_items.map((item) => (
                                            <tr key={item.id} className="border-b border-border/30 last:border-0">
                                              <td className="px-3 py-2 text-sm">{item.product_name}</td>
                                              <td className="px-3 py-2 text-right font-semibold">{item.quantity}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Aucun produit.</p>
                                  )}

                                  <div className="mt-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={downloadingId === quote.id}
                                      onClick={() => handleDownloadPDF(quote.id)}
                                    >
                                      {downloadingId === quote.id ? (
                                        <Loader2 size={14} className="animate-spin mr-2" />
                                      ) : (
                                        <Download size={14} className="mr-2" />
                                      )}
                                      Télécharger PDF
                                    </Button>
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
