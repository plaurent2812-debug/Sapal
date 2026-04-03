'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Trash2, Search, Loader2, Package } from 'lucide-react'

interface ProductWithCategory {
  id: string
  name: string
  slug: string
  reference: string
  price: number
  image_url: string
  category_id: string
  categories: { name: string } | null
}

export default function AdminProduitsPage() {
  const [products, setProducts] = useState<ProductWithCategory[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const perPage = 25

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    setLoading(true)
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, reference, price, image_url, category_id, categories(name)')
      .order('name')

    if (!error && data) {
      setProducts(data as unknown as ProductWithCategory[])
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.reference && p.reference.toLowerCase().includes(q))
    )
  }, [products, search])

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice(page * perPage, (page + 1) * perPage)

  // Reset to first page when search changes
  useEffect(() => {
    setPage(0)
  }, [search])

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Supprimer le produit "${name}" ?`)) return

    const supabase = createBrowserClient()
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
      return
    }
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Produits</h1>
        <Link href="/admin/produits/nouveau">
          <Button>
            <Plus size={16} className="mr-2" />
            Ajouter un produit
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" />
          Chargement...
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {filtered.length} produit{filtered.length > 1 ? 's' : ''}
            {search && ` pour "${search}"`}
          </p>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold">Produit</th>
                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Reference</th>
                    <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Categorie</th>
                    <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">Prix HT</th>
                    <th className="text-right px-4 py-3 font-semibold w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">
                        <Package size={32} className="mx-auto mb-2 opacity-40" />
                        Aucun produit trouve.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((product) => (
                      <tr key={product.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-secondary/30 overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                              {product.image_url ? (
                                <Image src={product.image_url} alt="" fill sizes="40px" className="object-contain p-1" />
                              ) : (
                                <Package size={16} className="text-muted-foreground/40" />
                              )}
                            </div>
                            <span className="font-medium truncate max-w-[200px] lg:max-w-[300px]">{product.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="font-mono text-xs text-muted-foreground">{product.reference || '---'}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                          {product.categories?.name || '---'}
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          {product.price > 0
                            ? `${Number(product.price).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} \u20AC`
                            : '---'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/admin/produits/${product.id}`}>
                              <Button variant="ghost" size="icon" title="Modifier">
                                <Pencil size={15} />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Supprimer"
                              onClick={() => handleDelete(product.id, product.name)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 size={15} />
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} / {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Precedent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
