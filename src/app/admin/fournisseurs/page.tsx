'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Loader2, Truck } from 'lucide-react'

interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  payment_terms: '30j' | 'prepayment'
  products_count?: number
}

export default function AdminFournisseursPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchSuppliers()
  }, [])

  async function fetchSuppliers() {
    setLoading(true)
    try {
      const res = await fetch('/api/suppliers')
      if (!res.ok) throw new Error('Erreur lors du chargement')
      const json = await res.json()
      setSuppliers(json.suppliers ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Supprimer le fournisseur "${name}" ?`)) return

    setDeleting(id)
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? 'Erreur lors de la suppression')
        return
      }
      setSuppliers((prev) => prev.filter((s) => s.id !== id))
    } catch {
      alert('Erreur lors de la suppression')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Fournisseurs</h1>
        <Link href="/admin/fournisseurs/nouveau">
          <Button>
            <Plus size={16} className="mr-2" />
            Nouveau fournisseur
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" />
          Chargement...
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {suppliers.length} fournisseur{suppliers.length > 1 ? 's' : ''}
          </p>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold">Nom</th>
                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Telephone</th>
                    <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Reglement</th>
                    <th className="text-right px-4 py-3 font-semibold w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">
                        <Truck size={32} className="mx-auto mb-2 opacity-40" />
                        Aucun fournisseur.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((supplier) => (
                      <tr
                        key={supplier.id}
                        className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium">{supplier.name}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {supplier.email || '---'}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                          {supplier.phone || '---'}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {supplier.payment_terms === '30j' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-500/15 text-green-700 text-xs font-medium">
                              30j FDM
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-700 text-xs font-medium">
                              Prepaiement
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/admin/fournisseurs/${supplier.id}`}>
                              <Button variant="ghost" size="icon" title="Modifier">
                                <Pencil size={15} />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Supprimer"
                              onClick={() => handleDelete(supplier.id, supplier.name)}
                              disabled={deleting === supplier.id}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              {deleting === supplier.id ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Trash2 size={15} />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
