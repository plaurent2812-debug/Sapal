'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  Loader2,
  CreditCard,
  Download,
  CheckCircle,
  ArrowLeft,
  Calendar,
  Building2,
} from 'lucide-react'

interface Supplier {
  name: string
  email: string | null
}

interface Order {
  order_number: string
}

interface SupplierOrderRow {
  id: string
  status: 'awaiting_payment' | 'proforma_sent'
  bdc_number: string | null
  bdc_pdf_url: string | null
  total_ht: number | null
  payment_terms: string | null
  created_at: string
  suppliers: Supplier | null
  orders: Order | null
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function CommandesAPayerPage() {
  const [rows, setRows] = useState<SupplierOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAwaitingPayment()
  }, [])

  async function fetchAwaitingPayment() {
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    const { data, error: fetchError } = await supabase
      .from('supplier_orders')
      .select(`
        id,
        status,
        bdc_number,
        bdc_pdf_url,
        total_ht,
        payment_terms,
        created_at,
        suppliers(name, email),
        orders(order_number)
      `)
      .in('status', ['awaiting_payment', 'proforma_sent'])
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else if (data) {
      setRows(data as unknown as SupplierOrderRow[])
    }
    setLoading(false)
  }

  async function handleMarkPaid(supplierOrderId: string) {
    const confirmed = window.confirm(
      'Confirmez-vous avoir effectué le paiement pour ce BDC ?'
    )
    if (!confirmed) return

    setMarkingPaidId(supplierOrderId)
    setError(null)
    try {
      const res = await fetch(`/api/supplier-orders/${supplierOrderId}/mark-paid`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur lors de la mise à jour')
      }
      // Optimistic: remove from list
      setRows((prev) => prev.filter((r) => r.id !== supplierOrderId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur serveur')
    } finally {
      setMarkingPaidId(null)
    }
  }

  function handleDownloadBDC(row: SupplierOrderRow) {
    if (!row.bdc_pdf_url) return
    const a = document.createElement('a')
    a.href = row.bdc_pdf_url
    a.download = `BDC-${row.bdc_number ?? row.id}.pdf`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/commandes"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-heading text-3xl tracking-tight">Commandes à payer</h1>
        </div>
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
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CheckCircle size={32} className="mx-auto mb-2 opacity-40" />
          <p className="font-medium">Aucun BDC en attente de paiement.</p>
          <p className="text-sm mt-1">Toutes les commandes fournisseurs ont été réglées.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {rows.length} BDC{rows.length > 1 ? 's' : ''} en attente de paiement
          </p>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold">N° BDC</th>
                    <th className="text-left px-4 py-3 font-semibold">Statut</th>
                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Fournisseur</th>
                    <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">N° Commande</th>
                    <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">Montant HT</th>
                    <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Créé le</th>
                    <th className="text-center px-4 py-3 font-semibold w-48">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-xs">
                          {row.bdc_number ?? <span className="text-muted-foreground italic">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.status === 'proforma_sent' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                            Proforma envoyée
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                            En attente paiement
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-muted-foreground flex-shrink-0" />
                          <div>
                            <p className="font-medium">
                              {row.suppliers?.name ?? (
                                <span className="text-muted-foreground italic">Inconnu</span>
                              )}
                            </p>
                            {row.suppliers?.email && (
                              <a
                                href={`mailto:${row.suppliers.email}`}
                                className="text-xs text-primary hover:underline"
                              >
                                {row.suppliers.email}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {row.orders?.order_number ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            {row.orders.order_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-right font-medium">
                        {formatCurrency(row.total_ht)}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} />
                          {formatDate(row.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            disabled={!row.bdc_pdf_url}
                            onClick={() => handleDownloadBDC(row)}
                            title={row.bdc_pdf_url ? 'Télécharger le BDC' : 'Aucun PDF disponible'}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/30 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Download size={12} />
                            BDC
                          </button>
                          <button
                            disabled={markingPaidId === row.id}
                            onClick={() => handleMarkPaid(row.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {markingPaidId === row.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle size={12} />
                            )}
                            Payé
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
