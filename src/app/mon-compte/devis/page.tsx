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
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { STATUS_CONFIG, formatDate } from '@/lib/quote-utils'
import { useDownloadPDF } from '@/hooks/useDownloadPDF'

type QuoteStatus = 'pending' | 'sent' | 'accepted' | 'rejected'

interface QuoteItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  delai: string | null
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

interface ConfirmDialog {
  open: boolean
  quoteId: string
  action: 'accept' | 'reject'
}

export default function MonCompteDevisPage() {
  const [quotes, setQuotes] = useState<QuoteWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmDialog>({ open: false, quoteId: '', action: 'accept' })
  const [actionLoading, setActionLoading] = useState(false)
  const { downloadingId, handleDownloadPDF } = useDownloadPDF()

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

  useEffect(() => {
    fetchMyQuotes()
  }, [])

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function openConfirm(quoteId: string, action: 'accept' | 'reject') {
    setConfirm({ open: true, quoteId, action })
  }

  function closeConfirm() {
    setConfirm({ open: false, quoteId: '', action: 'accept' })
  }

  async function handleAction() {
    setActionLoading(true)
    const endpoint = confirm.action === 'accept'
      ? `/api/quotes/${confirm.quoteId}/accept`
      : `/api/quotes/${confirm.quoteId}/reject`

    try {
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Erreur lors de l\'action')
      }
      closeConfirm()
      setLoading(true)
      await fetchMyQuotes()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Mes Devis</h1>
        <Link
          href="/devis"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
        >
          <PlusCircle size={16} />
          Nouveau devis
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
          <Link
            href="/devis"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted/30 transition-colors"
          >
            <PlusCircle size={16} />
            Cr&eacute;er mon premier devis
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
                    <th className="text-center px-4 py-3 font-semibold">Actions</th>
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
                            <button
                              className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted/40 transition-colors"
                              onClick={(e) => { e.stopPropagation(); toggleExpand(quote.id) }}
                              aria-label={isExpanded ? 'Replier' : 'Etendre'}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
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
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {quote.status === 'sent' && (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openConfirm(quote.id, 'accept')}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                                >
                                  <CheckCircle size={13} />
                                  Accepter
                                </button>
                                <button
                                  onClick={() => openConfirm(quote.id, 'reject')}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
                                >
                                  <XCircle size={13} />
                                  Refuser
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="border-b border-border/50 bg-muted/5">
                            <td colSpan={6} className="px-4 py-5">
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
                                            <th className="text-right px-3 py-2 font-medium text-xs w-36">D&eacute;lai de livraison</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {quote.quote_items.map((item) => {
                                            const delaiDisplay = item.delai
                                              ? (/^\d+(\.\d+)?$/.test(item.delai) ? (Number(item.delai) >= 14 ? `${Math.ceil(Number(item.delai) / 7)} sem.` : `${item.delai} j`) : item.delai)
                                              : '—'
                                            return (
                                            <tr key={item.id} className="border-b border-border/30 last:border-0">
                                              <td className="px-3 py-2 text-sm">{item.product_name}</td>
                                              <td className="px-3 py-2 text-right font-semibold">{item.quantity}</td>
                                              <td className="px-3 py-2 text-right text-xs text-muted-foreground">{delaiDisplay}</td>
                                            </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Aucun produit.</p>
                                  )}

                                  <div className="mt-4">
                                    <button
                                      disabled={downloadingId === quote.id}
                                      onClick={() => handleDownloadPDF(quote.id)}
                                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm font-medium hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {downloadingId === quote.id ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <Download size={14} />
                                      )}
                                      T&eacute;l&eacute;charger PDF
                                    </button>
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

      {/* Confirmation dialog */}
      {confirm.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl border border-border shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="font-heading text-lg tracking-tight mb-2">
              {confirm.action === 'accept' ? 'Accepter ce devis ?' : 'Refuser ce devis ?'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {confirm.action === 'accept'
                ? 'En acceptant ce devis, vous confirmez votre accord pour la commande. Cette action ne peut pas être annulée.'
                : 'En refusant ce devis, vous signalez que vous ne souhaitez pas donner suite. Cette action ne peut pas être annulée.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeConfirm}
                disabled={actionLoading}
                className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted/30 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirm.action === 'accept'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                {confirm.action === 'accept' ? 'Confirmer l\'acceptation' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
