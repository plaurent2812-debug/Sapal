'use client'

import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronDown, ChevronUp, FileText, Mail, Phone, Building2, Calendar, Plus, Download, FileCheck, Info, ExternalLink, Send, Trash2 } from 'lucide-react'
import { STATUS_CONFIG, formatDate } from '@/lib/quote-utils'
import { useDownloadPDF } from '@/hooks/useDownloadPDF'

type QuoteStatus = 'pending' | 'sent' | 'accepted' | 'rejected' | 'cancelled'

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

export default function AdminDevisPage() {
  const [quotes, setQuotes] = useState<QuoteWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { downloadingId, handleDownloadPDF } = useDownloadPDF()
  const [chorusDownloadingId, setChorusDownloadingId] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sentSuccessId, setSentSuccessId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    fetchQuotes()
  }, [])

  async function fetchQuotes() {
    setLoading(true)
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('quotes')
      .select('*, quote_items(*)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setQuotes(data as unknown as QuoteWithItems[])
    }
    setLoading(false)
  }

  async function handleSendQuote(quoteId: string) {
    setSendingId(quoteId)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/send`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Erreur lors de l\'envoi du devis')
      }
      await fetchQuotes()
      setSentSuccessId(quoteId)
      setTimeout(() => setSentSuccessId(null), 3000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'envoi du devis')
    } finally {
      setSendingId(null)
    }
  }

  async function handleDeleteQuote(quoteId: string) {
    if (!confirm('Supprimer ce devis ? Cette action est irréversible.')) return
    setDeletingId(quoteId)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/delete`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Erreur lors de la suppression')
      }
      const body = await res.json()
      await fetchQuotes()
      setDeleteSuccessMsg(body.action === 'cancelled' ? 'Devis annulé' : 'Devis supprimé')
      setTimeout(() => setDeleteSuccessMsg(null), 3000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  async function handleDownloadChorusPDF(quoteId: string) {
    setChorusDownloadingId(quoteId)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/chorus-pdf`)
      if (!res.ok) throw new Error('Erreur téléchargement')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      alert('Erreur lors du téléchargement de la facture Chorus')
    } finally {
      setChorusDownloadingId(null)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Demandes de devis</h1>
        <Link href="/admin/devis/nouveau">
          <Button>
            <Plus size={16} className="mr-2" />
            Nouveau devis
          </Button>
        </Link>
      </div>

      {deleteSuccessMsg && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium animate-in fade-in">
          {deleteSuccessMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" />
          Chargement...
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText size={32} className="mx-auto mb-2 opacity-40" />
          Aucune demande de devis.
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {quotes.length} demande{quotes.length > 1 ? 's' : ''}
          </p>

          {/* Chorus Pro info box */}
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-blue-900 mb-1">Chorus Pro - Facturation collectivités</p>
                <p className="text-blue-800">
                  Pour les devis acceptés, téléchargez la facture au format Chorus Pro puis déposez-la sur{' '}
                  <a
                    href="https://chorus-pro.gouv.fr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-blue-600"
                  >
                    chorus-pro.gouv.fr
                    <ExternalLink size={12} />
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold w-8"></th>
                    <th className="text-left px-4 py-3 font-semibold">Entreprise</th>
                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Date</th>
                    <th className="text-center px-4 py-3 font-semibold w-44">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => {
                    const isExpanded = expandedId === quote.id
                    const config = STATUS_CONFIG[quote.status]

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
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-muted-foreground flex-shrink-0" />
                              <span className="font-medium">{quote.entity}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                            {quote.contact_name}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <a href={`mailto:${quote.email}`} className="text-primary hover:underline text-xs">
                              {quote.email}
                            </a>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                            {formatDate(quote.created_at, { withTime: true })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block text-xs font-semibold rounded-full px-3 py-1 border ${config.className}`}>
                              {config.label}
                            </span>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="border-b border-border/50 bg-muted/5">
                            <td colSpan={6} className="px-4 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Contact details */}
                                <div className="space-y-3">
                                  <h3 className="font-semibold text-sm">Informations de contact</h3>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Building2 size={14} />
                                      <span>{quote.entity}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <span className="font-medium text-foreground">{quote.contact_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Mail size={14} className="text-muted-foreground" />
                                      <a href={`mailto:${quote.email}`} className="text-primary hover:underline">{quote.email}</a>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Phone size={14} className="text-muted-foreground" />
                                      <a href={`tel:${quote.phone}`} className="hover:underline">{quote.phone}</a>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Calendar size={14} />
                                      <span>{formatDate(quote.created_at, { withTime: true })}</span>
                                    </div>
                                  </div>
                                  {quote.message && (
                                    <div className="mt-3">
                                      <p className="text-xs font-semibold text-muted-foreground mb-1">Message :</p>
                                      <p className="text-sm bg-background rounded-lg p-3 border border-border/50">{quote.message}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Quote items */}
                                <div>
                                  <h3 className="font-semibold text-sm mb-3">
                                    Produits demandes ({quote.quote_items?.length || 0})
                                  </h3>
                                  {quote.quote_items && quote.quote_items.length > 0 ? (
                                    <div className="border border-border/50 rounded-lg overflow-hidden">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="bg-muted/20 border-b border-border/50">
                                            <th className="text-left px-3 py-2 font-medium text-xs">Produit</th>
                                            <th className="text-right px-3 py-2 font-medium text-xs w-20">Qte</th>
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

                                  <div className="mt-4 flex flex-wrap gap-2">
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
                                    {quote.status === 'accepted' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={chorusDownloadingId === quote.id}
                                        onClick={() => handleDownloadChorusPDF(quote.id)}
                                        className="border-green-300 text-green-700 hover:bg-green-50"
                                      >
                                        {chorusDownloadingId === quote.id ? (
                                          <Loader2 size={14} className="animate-spin mr-2" />
                                        ) : (
                                          <FileCheck size={14} className="mr-2" />
                                        )}
                                        Facture Chorus Pro
                                      </Button>
                                    )}
                                  </div>

                                  {quote.status === 'pending' && (
                                    <div className="mt-4">
                                      {sentSuccessId === quote.id ? (
                                        <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 inline-block">
                                          Devis envoyé avec succès.
                                        </p>
                                      ) : (
                                        <Button
                                          size="sm"
                                          disabled={sendingId === quote.id}
                                          onClick={() => handleSendQuote(quote.id)}
                                        >
                                          {sendingId === quote.id ? (
                                            <Loader2 size={14} className="animate-spin mr-2" />
                                          ) : (
                                            <Send size={14} className="mr-2" />
                                          )}
                                          Envoyer le devis au client
                                        </Button>
                                      )}
                                    </div>
                                  )}

                                  {quote.status === 'sent' && (
                                    <p className="mt-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 inline-block">
                                      Envoyé — en attente de réponse client
                                    </p>
                                  )}

                                  {quote.status === 'cancelled' && (
                                    <p className="mt-4 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 inline-block">
                                      Devis annulé
                                    </p>
                                  )}

                                  {quote.status !== 'cancelled' && (
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={deletingId === quote.id}
                                        onClick={() => handleDeleteQuote(quote.id)}
                                        className="border-red-200 text-red-600 hover:bg-red-50"
                                      >
                                        {deletingId === quote.id ? (
                                          <Loader2 size={14} className="animate-spin mr-2" />
                                        ) : (
                                          <Trash2 size={14} className="mr-2" />
                                        )}
                                        Supprimer le devis
                                      </Button>
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
