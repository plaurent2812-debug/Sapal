'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Trash2, Loader2, Save, X, FolderOpen } from 'lucide-react'

interface CategoryWithCount {
  id: string
  name: string
  slug: string
  description: string
  image_url: string
  products: { count: number }[]
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function generateId(): string {
  return crypto.randomUUID()
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [loading, setLoading] = useState(true)

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addSlug, setAddSlug] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addImageUrl, setAddImageUrl] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // Edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    setLoading(true)
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('categories')
      .select('*, products(count)')
      .order('name')

    if (!error && data) {
      setCategories(data as unknown as CategoryWithCount[])
    }
    setLoading(false)
  }

  // Auto-generate slug for add form
  useEffect(() => {
    setAddSlug(generateSlug(addName))
  }, [addName])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setAddSaving(true)

    const supabase = createBrowserClient()
    const { error: insertError } = await supabase.from('categories').insert({
      id: generateId(),
      name: addName.trim(),
      slug: addSlug,
      description: addDescription.trim(),
      image_url: addImageUrl.trim(),
    })

    if (insertError) {
      setError(insertError.message)
      setAddSaving(false)
      return
    }

    setAddName('')
    setAddSlug('')
    setAddDescription('')
    setAddImageUrl('')
    setShowAdd(false)
    setAddSaving(false)
    fetchCategories()
  }

  function startEdit(cat: CategoryWithCount) {
    setEditId(cat.id)
    setEditName(cat.name)
    setEditSlug(cat.slug)
    setEditDescription(cat.description || '')
    setEditImageUrl(cat.image_url || '')
    setError(null)
  }

  function cancelEdit() {
    setEditId(null)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    setError(null)
    setEditSaving(true)

    const supabase = createBrowserClient()
    const { error: updateError } = await supabase
      .from('categories')
      .update({
        name: editName.trim(),
        slug: editSlug,
        description: editDescription.trim(),
        image_url: editImageUrl.trim(),
      })
      .eq('id', editId)

    if (updateError) {
      setError(updateError.message)
      setEditSaving(false)
      return
    }

    setEditId(null)
    setEditSaving(false)
    fetchCategories()
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Supprimer la categorie "${name}" ? Les produits associes ne seront pas supprimes.`)) return

    const supabase = createBrowserClient()
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }

  function getProductCount(cat: CategoryWithCount): number {
    if (Array.isArray(cat.products) && cat.products.length > 0) {
      return cat.products[0]?.count ?? 0
    }
    return 0
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Categories</h1>
        <Button onClick={() => { setShowAdd(true); setEditId(null) }}>
          <Plus size={16} className="mr-2" />
          Ajouter une categorie
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-8 p-6 border border-border rounded-lg bg-card space-y-4">
          <h2 className="font-semibold text-lg">Nouvelle categorie</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Nom <span className="text-destructive">*</span></label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} required placeholder="Ex: Mobilier urbain" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Slug</label>
              <Input value={addSlug} onChange={(e) => setAddSlug(e.target.value)} className="font-mono text-sm" placeholder="genere automatiquement" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Description</label>
            <textarea
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              placeholder="Description de la categorie..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">URL de l&apos;image</label>
            <Input value={addImageUrl} onChange={(e) => setAddImageUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={addSaving}>
              {addSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
              Creer
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
              Annuler
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" />
          Chargement...
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold">Categorie</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Slug</th>
                  <th className="text-center px-4 py-3 font-semibold w-28">Produits</th>
                  <th className="text-right px-4 py-3 font-semibold w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-muted-foreground">
                      <FolderOpen size={32} className="mx-auto mb-2 opacity-40" />
                      Aucune categorie.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) =>
                    editId === cat.id ? (
                      <tr key={cat.id} className="border-b border-border/50 bg-muted/5">
                        <td colSpan={4} className="px-4 py-4">
                          <form onSubmit={handleEdit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-sm font-semibold">Nom</label>
                                <Input value={editName} onChange={(e) => { setEditName(e.target.value); setEditSlug(generateSlug(e.target.value)) }} required />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-sm font-semibold">Slug</label>
                                <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className="font-mono text-sm" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-semibold">Description</label>
                              <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                rows={2}
                                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-semibold">URL image</label>
                              <Input value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} />
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" disabled={editSaving}>
                                {editSaving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
                                Enregistrer
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={cancelEdit}>
                                <X size={14} className="mr-1" /> Annuler
                              </Button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : (
                      <tr key={cat.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-secondary/30 overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                              {cat.image_url ? (
                                <Image src={cat.image_url} alt="" fill sizes="40px" className="object-cover" unoptimized />
                              ) : (
                                <FolderOpen size={16} className="text-muted-foreground/40" />
                              )}
                            </div>
                            <div>
                              <span className="font-medium">{cat.name}</span>
                              {cat.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[300px]">{cat.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="font-mono text-xs text-muted-foreground">{cat.slug}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center bg-secondary/50 text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold">
                            {getProductCount(cat)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Modifier" onClick={() => startEdit(cat)}>
                              <Pencil size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Supprimer"
                              onClick={() => handleDelete(cat.id, cat.name)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
