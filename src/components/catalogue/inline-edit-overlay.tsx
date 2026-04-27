'use client'

import { useState, useCallback, useRef } from 'react'
import { Pencil, X, Save, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useAdminRole } from '@/hooks/useAdminRole'
import type { ClientProduct, ClientVariant } from '@/lib/data'

// -- Types --

interface ProductDraft {
  name: string
  description: string
  price: number
  image_url: string
  specifications: { key: string; value: string }[]
}

interface VariantDraft {
  id: string
  label: string
  coloris: string
  finition: string
  price: number
  delai: string
  images: string[]
  dirty: boolean
}

interface InlineEditOverlayProps {
  product: ClientProduct
  variants: ClientVariant[]
  onProductSaved: (updated: ClientProduct) => void
  onVariantsSaved: (updated: ClientVariant[]) => void
}

// -- Toast component (lightweight, no extra dependency) --

type ToastType = 'success' | 'error'

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  return (
    <div
      className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2 fade-in duration-300 ${
        type === 'success'
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-red-50 text-red-800 border border-red-200'
      }`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
        <X size={14} />
      </button>
    </div>
  )
}

// -- Main component --

export function InlineEditOverlay({
  product,
  variants,
  onProductSaved,
  onVariantsSaved,
}: InlineEditOverlayProps) {
  const { isAdmin, loading: authLoading } = useAdminRole()

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Product draft
  const [productDraft, setProductDraft] = useState<ProductDraft>(() =>
    productToDraft(product)
  )

  // Variant drafts
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>(() =>
    variants.map(variantToDraft)
  )

  // -- Helpers --

  function showToast(message: string, type: ToastType) {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // -- Toggle edit mode --

  const enterEditMode = useCallback(() => {
    setProductDraft(productToDraft(product))
    setVariantDrafts(variants.map(variantToDraft))
    setEditMode(true)
  }, [product, variants])

  const cancelEditMode = useCallback(() => {
    setEditMode(false)
    setProductDraft(productToDraft(product))
    setVariantDrafts(variants.map(variantToDraft))
  }, [product, variants])

  // -- Product field updaters --

  const updateProductField = useCallback(
    <K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => {
      setProductDraft(prev => ({ ...prev, [field]: value }))
    },
    []
  )

  const addSpec = useCallback(() => {
    setProductDraft(prev => ({
      ...prev,
      specifications: [...prev.specifications, { key: '', value: '' }],
    }))
  }, [])

  const removeSpec = useCallback((index: number) => {
    setProductDraft(prev => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== index),
    }))
  }, [])

  const updateSpec = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setProductDraft(prev => ({
      ...prev,
      specifications: prev.specifications.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }))
  }, [])

  // -- Image upload --

  const handleImageUpload = useCallback(async (file: File) => {
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'avif']
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !allowedExts.includes(ext)) {
      showToast('Format non supporté. Utilisez JPG, PNG, WEBP ou AVIF.', 'error')
      return
    }
    setUploadingImage(true)
    try {
      const supabase = createBrowserClient()
      const path = `${product.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      updateProductField('image_url', data.publicUrl)
      showToast('Image uploadée', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur upload', 'error')
    } finally {
      setUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }, [product.id, updateProductField])

  // -- Variant field updaters --

  const updateVariantField = useCallback(
    (variantId: string, field: keyof Pick<VariantDraft, 'price' | 'delai'>, value: string | number) => {
      setVariantDrafts(prev =>
        prev.map(v =>
          v.id === variantId ? { ...v, [field]: value, dirty: true } : v
        )
      )
    },
    []
  )

  const updateVariantImages = useCallback((variantId: string, images: string[]) => {
    setVariantDrafts(prev =>
      prev.map(v =>
        v.id === variantId ? { ...v, images, dirty: true } : v
      )
    )
  }, [])

  // -- Save --

  const handleSave = useCallback(async () => {
    setSaving(true)

    try {
      // 1. Save product
      const specsObj: Record<string, string> = {}
      for (const spec of productDraft.specifications) {
        if (spec.key.trim()) {
          specsObj[spec.key.trim()] = spec.value.trim()
        }
      }

      const productPayload = {
        name: productDraft.name,
        description: productDraft.description,
        price: productDraft.price,
        image_url: productDraft.image_url,
        specifications: specsObj,
      }

      const productRes = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload),
      })

      if (!productRes.ok) {
        const err = await productRes.json()
        throw new Error(err.error || 'Erreur produit')
      }

      const { product: updatedProductRow } = await productRes.json()

      // 2. Save dirty variants
      const dirtyVariants = variantDrafts.filter(v => v.dirty)
      const updatedVariantRows: Record<string, unknown>[] = []

      for (const v of dirtyVariants) {
        const variantPayload = {
          price: v.price,
          delai: v.delai,
          images: v.images.filter(Boolean),
        }

        const variantRes = await fetch(`/api/admin/variants/${v.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(variantPayload),
        })

        if (!variantRes.ok) {
          const err = await variantRes.json()
          throw new Error(err.error || `Erreur variante ${v.label}`)
        }

        const { variant: updatedRow } = await variantRes.json()
        updatedVariantRows.push(updatedRow)
      }

      // 3. Rebuild client-side objects
      const updatedProduct: ClientProduct = {
        ...product,
        name: updatedProductRow.name,
        description: updatedProductRow.description,
        price: Number(updatedProductRow.price) || 0,
        imageUrl: updatedProductRow.image_url,
        specifications: updatedProductRow.specifications,
      }

      const updatedVariants = variants.map(v => {
        const updated = updatedVariantRows.find(
          (r: Record<string, unknown>) => r.id === v.id
        )
        if (!updated) return v
        return {
          ...v,
          price: Number(updated.price) || 0,
          delai: (updated.delai as string) || '',
          images: (updated.images as string[]) || [],
        }
      })

      onProductSaved(updatedProduct)
      onVariantsSaved(updatedVariants)

      setEditMode(false)
      showToast('Modifications enregistrées', 'success')
    } catch (err) {
      console.error('Save error:', err)
      showToast(
        err instanceof Error ? err.message : 'Erreur lors de la sauvegarde',
        'error'
      )
    } finally {
      setSaving(false)
    }
  }, [product, variants, productDraft, variantDrafts, onProductSaved, onVariantsSaved])

  // -- Render --

  if (authLoading || !isAdmin) return null

  return (
    <>
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Toggle FAB */}
      {!editMode && (
        <button
          onClick={enterEditMode}
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity text-sm font-medium cursor-pointer"
        >
          <Pencil size={16} />
          Mode édition
        </button>
      )}

      {/* Edit Panel */}
      {editMode && (
        <div className="fixed bottom-0 right-0 z-50 w-full max-w-lg max-h-[85vh] overflow-y-auto bg-background border-l border-t border-border shadow-2xl rounded-tl-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
            <h3 className="font-heading text-lg font-semibold">Édition inline</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEditMode}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
              >
                <X size={14} />
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Sauvegarder
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Product fields */}
          <div className="px-6 py-5 space-y-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Produit
            </h4>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Nom</label>
              <input
                type="text"
                value={productDraft.name}
                onChange={e => updateProductField('name', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Description</label>
              <textarea
                value={productDraft.description}
                onChange={e => updateProductField('description', e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              />
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Prix de vente HT</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={productDraft.price}
                onChange={e => updateProductField('price', parseFloat(e.target.value) || 0)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Image principale */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Image principale</label>
              {productDraft.image_url && (
                <div className="relative w-full h-28 rounded-lg overflow-hidden border border-border bg-secondary/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={productDraft.image_url} alt="Aperçu" className="w-full h-full object-contain p-2" />
                </div>
              )}
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary/40 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {uploadingImage ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {uploadingImage ? 'Upload…' : 'Choisir'}
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
                />
                <input
                  type="text"
                  value={productDraft.image_url}
                  onChange={e => updateProductField('image_url', e.target.value)}
                  placeholder="https://… ou coller une URL"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-xs"
                />
              </div>
            </div>

            {/* Specifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Spécifications</label>
                <button
                  type="button"
                  onClick={addSpec}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors cursor-pointer"
                >
                  <Plus size={12} /> Ajouter
                </button>
              </div>

              {productDraft.specifications.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucune spécification.</p>
              )}

              {productDraft.specifications.map((spec, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    placeholder="Clé"
                    value={spec.key}
                    onChange={e => updateSpec(i, 'key', e.target.value)}
                    className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <input
                    placeholder="Valeur"
                    value={spec.value}
                    onChange={e => updateSpec(i, 'value', e.target.value)}
                    className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => removeSpec(i)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 p-1 rounded cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* -- Variants section -- */}
            {/* Masquer si 1 seule variante sans attribut distinctif (coloris/finition non génériques) */}
            {(() => {
              const GENERIC = new Set(['standard', 'défaut', 'default', ''])
              const isDistinct = (v: VariantDraft) =>
                (v.coloris && !GENERIC.has(v.coloris.toLowerCase())) ||
                (v.finition && !GENERIC.has(v.finition.toLowerCase()))
              return variantDrafts.length > 1 || (variantDrafts.length === 1 && isDistinct(variantDrafts[0]))
            })() ? (
              <>
                <div className="border-t border-border pt-5 mt-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    Variantes ({variantDrafts.length})
                  </h4>
                </div>

                <div className="space-y-4">
                  {variantDrafts.map(v => (
                    <div
                      key={v.id}
                      className={`rounded-xl border p-4 space-y-3 ${
                        v.dirty ? 'border-accent/50 bg-accent/5' : 'border-border'
                      }`}
                    >
                      <div className="text-sm font-semibold">
                        {v.label}
                        {v.coloris && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {v.coloris}
                          </span>
                        )}
                        {v.finition && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            / {v.finition}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Price */}
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Prix HT</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={v.price}
                            onChange={e =>
                              updateVariantField(v.id, 'price', parseFloat(e.target.value) || 0)
                            }
                            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>

                        {/* Delai */}
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Délai de livraison</label>
                          <input
                            type="text"
                            value={v.delai}
                            onChange={e =>
                              updateVariantField(v.id, 'delai', e.target.value)
                            }
                            placeholder='Ex : "6 semaines" ou "En stock"'
                            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                          <p className="text-[10px] text-muted-foreground/80 leading-tight">
                            Inclure l&apos;unité : « 6 semaines », « 3 jours », « En stock »…
                          </p>
                        </div>
                      </div>

                      {/* Images */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">
                          Images — clic pour définir la principale, glisser pour réordonner
                        </label>
                        <ImageGalleryEditor
                          productId={product.id}
                          images={v.images.filter(Boolean)}
                          primaryImageUrl={productDraft.image_url}
                          onChange={imgs => updateVariantImages(v.id, imgs)}
                          onPrimaryChange={url => updateProductField('image_url', url)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}

// -- ImageGalleryEditor component --

function ImageGalleryEditor({
  productId,
  images,
  primaryImageUrl,
  onChange,
  onPrimaryChange,
}: {
  productId: string
  images: string[]
  primaryImageUrl: string
  onChange: (images: string[]) => void
  onPrimaryChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(files: FileList | File[]) {
    const supabase = createBrowserClient()
    setUploading(true)
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !['jpg','jpeg','png','webp','avif'].includes(ext)) continue
      const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        newUrls.push(data.publicUrl)
      }
    }
    setUploading(false)
    if (newUrls.length === 0) return
    const merged = [...images, ...newUrls]
    onChange(merged)
    // Si pas encore d'image principale, définir la première uploadée
    if (!primaryImageUrl) onPrimaryChange(newUrls[0])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  function removeImage(idx: number) {
    const removed = images[idx]
    const next = images.filter((_, i) => i !== idx)
    onChange(next)
    if (removed === primaryImageUrl) {
      onPrimaryChange(next[0] ?? '')
    }
  }

  function moveImage(from: number, to: number) {
    const next = [...images]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {/* Drop zone + bouton */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed transition-colors ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border'
        }`}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-border rounded-md text-xs hover:bg-secondary/40 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? 'Upload…' : 'Choisir'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { if (e.target.files) { uploadFiles(e.target.files); e.target.value = '' } }} />
        <span className="text-xs text-muted-foreground">ou glisser des images ici</span>
      </div>

      {/* Grille de miniatures */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {images.map((url, idx) => {
            const isPrimary = url === primaryImageUrl
            return (
              <div
                key={url + idx}
                draggable
                onDragStart={() => setDraggingIdx(idx)}
                onDragOver={e => { e.preventDefault() }}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); if (draggingIdx !== null && draggingIdx !== idx) { moveImage(draggingIdx, idx); setDraggingIdx(null) } }}
                className={`relative group rounded-md overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${
                  isPrimary ? 'border-accent' : 'border-transparent hover:border-border'
                }`}
                style={{ aspectRatio: '1' }}
                title={isPrimary ? 'Image principale' : 'Cliquer pour définir comme principale'}
                onClick={() => onPrimaryChange(url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                {isPrimary && (
                  <div className="absolute bottom-0 left-0 right-0 bg-accent/80 text-white text-[9px] text-center py-0.5 font-semibold">
                    Principale
                  </div>
                )}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); removeImage(idx) }}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={9} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// -- Pure helpers (outside component) --

function productToDraft(p: ClientProduct): ProductDraft {
  return {
    name: p.name,
    description: p.description,
    price: p.price,
    image_url: p.imageUrl,
    specifications: Object.entries(p.specifications).map(([key, value]) => ({
      key,
      value: String(value),
    })),
  }
}

function variantToDraft(v: ClientVariant): VariantDraft {
  return {
    id: v.id,
    label: v.label,
    coloris: v.coloris,
    finition: v.finition,
    price: v.price,
    delai: v.delai,
    images: [...v.images],
    dirty: false,
  }
}
