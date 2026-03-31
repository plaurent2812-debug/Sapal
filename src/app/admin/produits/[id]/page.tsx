'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Plus, Trash2, Loader2, Save } from 'lucide-react'

interface CategoryOption {
  id: string
  name: string
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function EditProduitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [price, setPrice] = useState('')
  const [reference, setReference] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [supplierUrl, setSupplierUrl] = useState('')
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient()

      const [productRes, categoriesRes] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).single(),
        supabase.from('categories').select('id, name').order('name'),
      ])

      if (categoriesRes.data) setCategories(categoriesRes.data)

      if (productRes.error || !productRes.data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const p = productRes.data
      setName(p.name || '')
      setSlug(p.slug || '')
      setDescription(p.description || '')
      setCategoryId(p.category_id || '')
      setPrice(p.price ? String(p.price) : '')
      setReference(p.reference || '')
      setImageUrl(p.image_url || '')
      setSupplierUrl(p.supplier_url || '')

      if (p.specifications && typeof p.specifications === 'object') {
        const entries = Object.entries(p.specifications as Record<string, string>)
        setSpecs(entries.map(([key, value]) => ({ key, value: String(value) })))
      }

      setLoading(false)
    }
    load()
  }, [id])

  function addSpec() {
    setSpecs((prev) => [...prev, { key: '', value: '' }])
  }

  function removeSpec(index: number) {
    setSpecs((prev) => prev.filter((_, i) => i !== index))
  }

  function updateSpec(index: number, field: 'key' | 'value', value: string) {
    setSpecs((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  function handleNameChange(newName: string) {
    setName(newName)
    setSlug(generateSlug(newName))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const specifications: Record<string, string> = {}
    for (const spec of specs) {
      if (spec.key.trim()) {
        specifications[spec.key.trim()] = spec.value.trim()
      }
    }

    const supabase = createBrowserClient()
    const { error: updateError } = await supabase
      .from('products')
      .update({
        name: name.trim(),
        slug,
        description: description.trim(),
        category_id: categoryId || null,
        price: price ? parseFloat(price) : 0,
        reference: reference.trim(),
        image_url: imageUrl.trim(),
        supplier_url: supplierUrl.trim(),
        specifications,
      })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    router.push('/admin/produits')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={24} className="animate-spin mr-2" />
        Chargement...
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="text-center py-20">
        <h1 className="font-heading text-2xl mb-4">Produit introuvable</h1>
        <Link href="/admin/produits">
          <Button variant="outline">Retour aux produits</Button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link
        href="/admin/produits"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft size={16} className="mr-1" /> Retour aux produits
      </Link>

      <h1 className="font-heading text-3xl tracking-tight mb-8">Modifier le produit</h1>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            Nom <span className="text-destructive">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            placeholder="Ex: Panneau de signalisation AB3a"
          />
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Slug</label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="genere automatiquement"
            className="font-mono text-sm"
          />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Categorie</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">-- Aucune categorie --</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            placeholder="Description du produit..."
          />
        </div>

        {/* Price + Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Prix HT (EUR)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Reference</label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="REF-001"
            />
          </div>
        </div>

        {/* Image URL */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">URL de l&apos;image</label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        {/* Supplier URL */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">URL fournisseur</label>
          <Input
            value={supplierUrl}
            onChange={(e) => setSupplierUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        {/* Specifications */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Specifications</label>
            <Button type="button" variant="outline" size="sm" onClick={addSpec}>
              <Plus size={14} className="mr-1" /> Ajouter
            </Button>
          </div>

          {specs.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune specification.</p>
          )}

          {specs.map((spec, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Cle (ex: Poids)"
                value={spec.key}
                onChange={(e) => updateSpec(i, 'key', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Valeur (ex: 5 kg)"
                value={spec.value}
                onChange={(e) => updateSpec(i, 'value', e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSpec(i)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" /> Enregistrement...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" /> Enregistrer
              </>
            )}
          </Button>
          <Link href="/admin/produits">
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
