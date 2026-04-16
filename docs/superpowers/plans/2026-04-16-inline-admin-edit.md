# Inline Admin Edit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un mode edition inline sur les pages produit, accessible uniquement aux admins, permettant de modifier nom/description/prix/specs/images directement depuis la page catalogue sans quitter le site.

**Architecture:** Double verification admin (client + serveur). Le composant InlineEditOverlay s'affiche cote client si role=admin, les sauvegardes passent par des API routes Next.js qui re-verifient le JWT avant tout UPDATE Supabase.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase Auth JWT, Supabase JS client

---

## Task 1 — Hook `useAdminRole` + API routes securisees

**Files created:**
- `src/hooks/useAdminRole.ts`
- `src/app/api/admin/products/[id]/route.ts`
- `src/app/api/admin/variants/[id]/route.ts`

**Files modified:** _(none)_

### Steps

- [ ] **1.1** Create `src/hooks/useAdminRole.ts`

```typescript
// src/hooks/useAdminRole.ts
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

export function useAdminRole() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = user?.user_metadata?.role
      setIsAdmin(role === 'admin')
      setLoading(false)
    })
  }, [])

  return { isAdmin, loading }
}
```

> **Note:** On utilise `getUser()` (pas `getSession()`) car `getUser()` valide le JWT cote Supabase Auth, tandis que `getSession()` lit seulement le cookie local — plus securise. Le hook ne retourne `true` que pour `role === 'admin'`, pas `gerant`, car seul Pierre doit editer les produits inline.

- [ ] **1.2** Create `src/app/api/admin/products/[id]/route.ts`

```typescript
// src/app/api/admin/products/[id]/route.ts
import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { revalidateTag } from 'next/cache'

const productPatchSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').optional(),
  description: z.string().optional(),
  price: z.number().min(0, 'Le prix doit etre positif').optional(),
  image_url: z.string().optional(),
  specifications: z.record(z.string(), z.string()).optional(),
})

async function checkAdmin() {
  const authClient = await createServerSupabaseClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()

  if (!user) {
    return { user: null, error: Response.json({ error: 'Non autorise' }, { status: 401 }) }
  }

  const role = (user.user_metadata?.role as string) ?? 'client'
  if (role !== 'admin') {
    return { user: null, error: Response.json({ error: 'Acces refuse' }, { status: 403 }) }
  }

  return { user, error: null }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await checkAdmin()
    if (authError) return authError

    const { id } = await params
    const body = await request.json()
    const parsed = productPatchSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Build update payload — only include fields that were sent
    const updatePayload: Record<string, unknown> = {}
    if (data.name !== undefined) updatePayload.name = data.name.trim()
    if (data.description !== undefined) updatePayload.description = data.description.trim()
    if (data.price !== undefined) updatePayload.price = data.price
    if (data.image_url !== undefined) updatePayload.image_url = data.image_url.trim()
    if (data.specifications !== undefined) updatePayload.specifications = data.specifications

    if (Object.keys(updatePayload).length === 0) {
      return Response.json({ error: 'Aucun champ a mettre a jour' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: product, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating product:', error)
      return Response.json({ error: 'Erreur lors de la mise a jour du produit' }, { status: 500 })
    }

    // Revalidate the product cache so the page reflects changes immediately
    revalidateTag('products')

    return Response.json({ product })
  } catch (err) {
    console.error('API Error:', err)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **1.3** Create `src/app/api/admin/variants/[id]/route.ts`

```typescript
// src/app/api/admin/variants/[id]/route.ts
import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

const variantPatchSchema = z.object({
  price: z.number().min(0, 'Le prix doit etre positif').optional(),
  delai: z.string().optional(),
  images: z.array(z.string()).optional(),
})

async function checkAdmin() {
  const authClient = await createServerSupabaseClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()

  if (!user) {
    return { user: null, error: Response.json({ error: 'Non autorise' }, { status: 401 }) }
  }

  const role = (user.user_metadata?.role as string) ?? 'client'
  if (role !== 'admin') {
    return { user: null, error: Response.json({ error: 'Acces refuse' }, { status: 403 }) }
  }

  return { user, error: null }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await checkAdmin()
    if (authError) return authError

    const { id } = await params
    const body = await request.json()
    const parsed = variantPatchSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    const updatePayload: Record<string, unknown> = {}
    if (data.price !== undefined) updatePayload.price = data.price
    if (data.delai !== undefined) updatePayload.delai = data.delai.trim()
    if (data.images !== undefined) updatePayload.images = data.images.map(u => u.trim()).filter(Boolean)

    if (Object.keys(updatePayload).length === 0) {
      return Response.json({ error: 'Aucun champ a mettre a jour' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: variant, error } = await supabase
      .from('product_variants')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating variant:', error)
      return Response.json({ error: 'Erreur lors de la mise a jour de la variante' }, { status: 500 })
    }

    return Response.json({ variant })
  } catch (err) {
    console.error('API Error:', err)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **1.4** Verify: run `npx tsc --noEmit` to check types compile

**Commit:** `feat(inline-edit): add useAdminRole hook and secured API routes for products/variants`

---

## Task 2 — Composant `InlineEditOverlay` (toggle + panneau produit)

**Files created:**
- `src/components/catalogue/inline-edit-overlay.tsx`

**Files modified:** _(none yet — integration in Task 3)_

### Steps

- [ ] **2.1** Create `src/components/catalogue/inline-edit-overlay.tsx`

```typescript
// src/components/catalogue/inline-edit-overlay.tsx
'use client'

import { useState, useCallback } from 'react'
import { Pencil, X, Save, Loader2, Plus, Trash2 } from 'lucide-react'
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
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
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
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

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
      showToast('Modifications enregistrees', 'success')
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
          Mode edition
        </button>
      )}

      {/* Edit Panel */}
      {editMode && (
        <div className="fixed bottom-0 right-0 z-50 w-full max-w-lg max-h-[85vh] overflow-y-auto bg-background border-l border-t border-border shadow-2xl rounded-tl-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
            <h3 className="font-heading text-lg font-semibold">Edition inline</h3>
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

            {/* Image URL */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">URL image principale</label>
              <input
                type="text"
                value={productDraft.image_url}
                onChange={e => updateProductField('image_url', e.target.value)}
                placeholder="https://..."
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-xs"
              />
            </div>

            {/* Specifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Specifications</label>
                <button
                  type="button"
                  onClick={addSpec}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors cursor-pointer"
                >
                  <Plus size={12} /> Ajouter
                </button>
              </div>

              {productDraft.specifications.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucune specification.</p>
              )}

              {productDraft.specifications.map((spec, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    placeholder="Cle"
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
            {variantDrafts.length > 0 && (
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
                          <label className="text-xs text-muted-foreground">Delai</label>
                          <input
                            type="text"
                            value={v.delai}
                            onChange={e =>
                              updateVariantField(v.id, 'delai', e.target.value)
                            }
                            placeholder="Ex: 14"
                            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>
                      </div>

                      {/* Images */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">
                          Images (URLs, une par ligne)
                        </label>
                        <textarea
                          value={v.images.join('\n')}
                          onChange={e =>
                            updateVariantImages(v.id, e.target.value.split('\n'))
                          }
                          rows={2}
                          placeholder="https://..."
                          className="flex w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
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
```

> **Design decisions:**
> - Pas de dependance toast externe (sonner, react-hot-toast) — le projet n'en a pas. On cree un Toast minimal inline.
> - Le panneau s'affiche en slide-over a droite (max-w-lg) pour ne pas cacher la page produit — Pierre peut voir les modifications en temps reel.
> - Les variantes sont dans le meme panneau, separees par un divider, avec un indicateur visuel (bordure accent) quand une variante a ete modifiee.
> - Un seul bouton "Sauvegarder" pour tout (produit + variantes dirty).

- [ ] **2.2** Verify: run `npx tsc --noEmit` to check types compile

**Commit:** `feat(inline-edit): add InlineEditOverlay component with product and variant editing`

---

## Task 3 — Integration dans `ProductPageClient`

**Files created:** _(none)_

**Files modified:**
- `src/components/catalogue/product-page-client.tsx`

### Steps

- [ ] **3.1** Modify `src/components/catalogue/product-page-client.tsx` to support edit mode

The key changes:
1. Lift `product` and `variants` into mutable state so `onProductSaved` / `onVariantsSaved` can update the displayed data
2. Render `InlineEditOverlay` at the bottom
3. Add a `useEffect` to keep `selectedVariant` in sync when variants are updated via inline edit

Here is the complete modified file:

```typescript
// src/components/catalogue/product-page-client.tsx
"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShieldCheck, Truck, Clock, Package } from "lucide-react"
import type { ClientProduct, ClientVariant, ClientCategory, ProductOption } from "@/lib/data"
import { VariantSelector } from "./variant-selector"
import { AddToQuoteSection } from "./add-to-quote-section"
import { ProductOptionsSection } from "./product-options-section"
import { InlineEditOverlay } from "./inline-edit-overlay"

interface Props {
  product: ClientProduct
  variants: ClientVariant[]
  options: ProductOption[]
  category: ClientCategory
  categorySlug: string
}

export function ProductPageClient({ product, variants, options, category, categorySlug }: Props) {
  // Mutable state for inline editing
  const [currentProduct, setCurrentProduct] = useState(product)
  const [currentVariants, setCurrentVariants] = useState(variants)

  const [selectedVariant, setSelectedVariant] = useState<ClientVariant | null>(
    currentVariants.length === 1 ? currentVariants[0] : null
  )
  const [activeImageIdx, setActiveImageIdx] = useState(0)

  // Sync selectedVariant when variants are updated via inline edit
  useEffect(() => {
    if (selectedVariant) {
      const updated = currentVariants.find(v => v.id === selectedVariant.id)
      if (updated) setSelectedVariant(updated)
    }
  }, [currentVariants]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayReference = selectedVariant?.reference || currentProduct.reference
  const displayPrice = selectedVariant ? selectedVariant.price : currentProduct.price

  // Galerie : images de la variante selectionnee, ou image produit par defaut
  const galleryImages = useMemo(() => {
    if (selectedVariant?.images && selectedVariant.images.length > 0) {
      return selectedVariant.images
    }
    return currentProduct.imageUrl ? [currentProduct.imageUrl] : []
  }, [selectedVariant, currentProduct.imageUrl])

  // Quand on change de variante, revenir a l'image 0
  const handleVariantSelect = (v: ClientVariant) => {
    setSelectedVariant(v)
    setActiveImageIdx(0)
  }

  const currentImage = galleryImages[activeImageIdx] ?? null

  const specifications = useMemo(() => {
    const specs = { ...currentProduct.specifications }

    if (selectedVariant) {
      if (selectedVariant.dimensions) specs['Dimensions'] = selectedVariant.dimensions
      if (selectedVariant.poids) specs['Poids'] = selectedVariant.poids
      if (selectedVariant.finition) specs['Finition'] = selectedVariant.finition
      if (selectedVariant.delai) specs['Delai'] = /^\d+(\.\d+)?$/.test(selectedVariant.delai)
        ? (Number(selectedVariant.delai) >= 14
          ? `${Math.ceil(Number(selectedVariant.delai) / 7)} semaines`
          : `${selectedVariant.delai} jours`)
        : selectedVariant.delai
      if (selectedVariant.specifications && Object.keys(selectedVariant.specifications).length > 0) {
        Object.assign(specs, selectedVariant.specifications)
      }
    }

    return Object.entries(specs)
  }, [currentProduct.specifications, selectedVariant])

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-16">
        {/* -- Colonne image -- */}
        <div className="space-y-3">
          {/* Image principale */}
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-br from-secondary/30 to-secondary/5 border border-border/50 relative group">
            {currentImage ? (
              <Image
                key={currentImage}
                src={currentImage}
                alt={currentProduct.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain p-6 md:p-8 group-hover:scale-105 transition-transform duration-500"
                priority
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Package size={48} className="mx-auto mb-3 opacity-30" />
                  <span className="text-sm">Photo non disponible</span>
                </div>
              </div>
            )}
            {displayReference && (
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-white/90 backdrop-blur text-[11px] sm:text-xs font-mono font-medium px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-muted-foreground border border-border/50 shadow-sm">
                Ref. {displayReference}
              </div>
            )}
          </div>

          {/* Miniatures galerie */}
          {galleryImages.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {galleryImages.map((img, i) => (
                <button
                  key={img}
                  onClick={() => setActiveImageIdx(i)}
                  aria-label={`${currentProduct.name} -- vue ${i + 1}`}
                  aria-pressed={i === activeImageIdx}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 ${
                    i === activeImageIdx
                      ? "border-accent"
                      : "border-border/50 hover:border-accent/50"
                  }`}
                >
                  <Image
                    src={img}
                    alt={`${currentProduct.name} vue ${i + 1}`}
                    width={56}
                    height={56}
                    className="object-contain w-full h-full p-1"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* -- Colonne infos -- */}
        <div className="flex flex-col">
          <div className="mb-2">
            <Link
              href={`/catalogue/${categorySlug}`}
              className="text-xs font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors"
            >
              {category.name}
            </Link>
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl tracking-tight mb-3 sm:mb-4">
            {currentProduct.name}
          </h1>

          {displayPrice > 0 && (
            <div className="mb-5 sm:mb-6 flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                {displayPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} &euro;
              </span>
              <span className="text-sm text-muted-foreground font-medium">HT / unite</span>
            </div>
          )}

          <VariantSelector
            variants={currentVariants}
            selectedVariant={selectedVariant}
            onSelect={handleVariantSelect}
            hasVariants={currentVariants.length > 0}
          />

          {displayReference && (
            <p className="text-xs font-mono text-muted-foreground mb-6">
              Ref. {displayReference}
            </p>
          )}

          {specifications.length > 0 && (
            <div className="mb-6 sm:mb-8">
              <h2 className="font-heading text-lg sm:text-xl mb-3 sm:mb-4">Caracteristiques</h2>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                {specifications.map(([key, value], i) => (
                  <div
                    key={key}
                    className={`flex justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5 text-sm ${
                      i % 2 === 0 ? "bg-muted/20" : "bg-background"
                    }`}
                  >
                    <span className="text-muted-foreground font-medium flex-shrink-0">{key}</span>
                    <span className="font-semibold text-right break-words min-w-0">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <AddToQuoteSection
            product={currentProduct}
            selectedVariant={selectedVariant}
            hasVariants={currentVariants.length > 0}
            categorySlug={categorySlug}
          />

          <ProductOptionsSection options={options} />

          <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-border/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Truck size={18} className="text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Livraison France</p>
                  <p className="text-xs text-muted-foreground">Delai selon stock</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={18} className="text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Certifie NF/CE</p>
                  <p className="text-xs text-muted-foreground">Normes en vigueur</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Clock size={18} className="text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Devis en 24h</p>
                  <p className="text-xs text-muted-foreground">Gratuit et sans engagement</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Package size={18} className="text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Mandat administratif</p>
                  <p className="text-xs text-muted-foreground">Paiement 30 jours</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Edit Overlay -- only visible to admins */}
      <InlineEditOverlay
        product={currentProduct}
        variants={currentVariants}
        onProductSaved={setCurrentProduct}
        onVariantsSaved={setCurrentVariants}
      />
    </>
  )
}
```

> **Key changes vs original file:**
> - Added `import { InlineEditOverlay } from "./inline-edit-overlay"` and `useEffect` to imports
> - Added `currentProduct` / `currentVariants` state so the page updates live after save
> - Replaced all `product.xxx` with `currentProduct.xxx` and `variants` with `currentVariants`
> - Added `useEffect` to keep `selectedVariant` in sync when variants update
> - Wrapped return in `<>` Fragment to add `InlineEditOverlay` as sibling
> - The overlay is rendered unconditionally but internally hides itself if the user isn't admin

- [ ] **3.2** Verify: run `npx tsc --noEmit` to check types compile

- [ ] **3.3** Manual verification: open a product page as admin, check the FAB appears, click it, verify the slide-over panel shows with correct data

**Commit:** `feat(inline-edit): integrate InlineEditOverlay into ProductPageClient`

---

## Task 4 — Panneau edition variantes (deja inclus dans Task 2)

> **Note:** Le panneau variantes est integre directement dans `InlineEditOverlay` (Task 2) car les separer en deux composants n'apporte pas de valeur — la sauvegarde est atomique (un seul clic), et les variantes sont affichees dans le meme panneau scrollable.

**Files created:** _(none -- already handled in Task 2)_

**Files modified:** _(none)_

### Steps

- [ ] **4.1** Verify the variant editing works end-to-end: open a product with variants, enter edit mode, modify a variant price, save, check the value updates on the page

- [ ] **4.2** Verify the variant dirty indicator: modify a variant field, check the border becomes accent-colored. Cancel without saving, re-enter edit mode, check the draft is reset to the original values

- [ ] **4.3** Verify error handling: disconnect from the internet, try to save, check the error toast appears

**Commit:** _(no commit -- verification only)_

---

## Task 5 — Mise a jour `admin-edit-button` + page produit + test end-to-end

**Files created:** _(none)_

**Files modified:**
- `src/components/catalogue/admin-edit-button.tsx` -- deprecate (return null)
- `src/app/catalogue/[slug]/[productSlug]/page.tsx` -- remove AdminEditButton import and usage

### Steps

- [ ] **5.1** Remove `AdminEditButton` usage from the product page

Modify `src/app/catalogue/[slug]/[productSlug]/page.tsx`:

1. Remove the import line: `import { AdminEditButton } from "@/components/catalogue/admin-edit-button"`
2. Remove the JSX usage: `<AdminEditButton productId={product.id} />`
3. The `InlineEditOverlay` is now rendered inside `ProductPageClient`, so the floating edit button from `AdminEditButton` is no longer needed.

The resulting page should look like the original but without the two `AdminEditButton` lines. Everything else stays identical.

- [ ] **5.2** Update `src/components/catalogue/admin-edit-button.tsx` -- keep the file but deprecate it

Rather than deleting the file (which could break other imports elsewhere), mark it as deprecated and make it a no-op:

```typescript
// src/components/catalogue/admin-edit-button.tsx
'use client'

/**
 * @deprecated Replaced by InlineEditOverlay rendered inside ProductPageClient.
 * This component is kept temporarily for backward compatibility.
 * Safe to delete once all references are removed.
 */
export function AdminEditButton({ productId: _productId }: { productId: string }) {
  return null
}
```

- [ ] **5.3** Check if `AdminEditButton` is used anywhere else

```bash
grep -rn "AdminEditButton" src/ --include="*.tsx" --include="*.ts"
```

If found elsewhere, remove those imports too. Based on the current codebase, it's only used in the product page which we already updated.

- [ ] **5.4** Run type check

```bash
npm run typecheck
```

- [ ] **5.5** Run lint

```bash
npm run lint
```

- [ ] **5.6** Run existing tests

```bash
npm run test
```

- [ ] **5.7** Manual end-to-end test checklist

1. Open a product page as a non-authenticated user:
   - [ ] No edit button visible
   - [ ] Page renders normally

2. Log in as admin (p.laurent@opti-pro.fr):
   - [ ] "Mode edition" FAB appears bottom-right
   - [ ] Click it: slide-over panel opens on the right
   - [ ] Product name, description, price, image URL, specifications are populated correctly
   - [ ] If the product has variants, they appear below the product section

3. Edit product fields:
   - [ ] Change the product name, verify the h1 on the page doesn't update yet (it updates after save)
   - [ ] Change the price
   - [ ] Add a specification
   - [ ] Remove a specification
   - [ ] Click "Sauvegarder"
   - [ ] Toast "Modifications enregistrees" appears
   - [ ] The page content updates immediately (name, price, specs)
   - [ ] Refresh the page -- changes persist

4. Edit variant fields:
   - [ ] Modify a variant price -- border turns accent
   - [ ] Modify a variant delai
   - [ ] Save
   - [ ] Select that variant -- price reflects the new value

5. Cancel flow:
   - [ ] Enter edit mode, make changes
   - [ ] Click "Annuler"
   - [ ] Re-enter edit mode -- fields show original values (not the unsaved changes)

6. Error handling:
   - [ ] Try to save with an empty product name -- API returns 400, toast shows error
   - [ ] Check browser Network tab: requests go to `/api/admin/products/[id]` with PATCH method

7. Security:
   - [ ] Log in as gerant -- no edit button visible (only admin, not gerant)
   - [ ] Try calling the API directly as gerant: `curl -X PATCH /api/admin/products/[id]` -- returns 403

**Commit:** `feat(inline-edit): replace AdminEditButton with inline editing, cleanup`

---

## Summary of all files

| File | Action |
|------|--------|
| `src/hooks/useAdminRole.ts` | CREATE |
| `src/app/api/admin/products/[id]/route.ts` | CREATE |
| `src/app/api/admin/variants/[id]/route.ts` | CREATE |
| `src/components/catalogue/inline-edit-overlay.tsx` | CREATE |
| `src/components/catalogue/product-page-client.tsx` | MODIFY |
| `src/components/catalogue/admin-edit-button.tsx` | MODIFY (deprecate) |
| `src/app/catalogue/[slug]/[productSlug]/page.tsx` | MODIFY |

## Architecture diagram

```
Browser (admin logged in)
  |
  +-- ProductPageClient
  |     +-- currentProduct (state)
  |     +-- currentVariants (state)
  |     +-- InlineEditOverlay
  |           +-- useAdminRole() --> getUser() --> show/hide
  |           +-- ProductDraft (local state)
  |           +-- VariantDraft[] (local state)
  |           |
  |           +-- [Save] --> fetch PATCH /api/admin/products/[id]
  |           |          --> fetch PATCH /api/admin/variants/[id] (x dirty)
  |           |
  |           +-- onProductSaved(updatedProduct) --> setCurrentProduct
  |           +-- onVariantsSaved(updatedVariants) --> setCurrentVariants
  |
  Server (API Routes)
  |
  +-- /api/admin/products/[id] PATCH
  |     +-- createServerSupabaseClient() --> getUser() --> check role=admin
  |     +-- zod validation
  |     +-- createServiceRoleClient() --> UPDATE products
  |     +-- revalidateTag('products')
  |
  +-- /api/admin/variants/[id] PATCH
        +-- createServerSupabaseClient() --> getUser() --> check role=admin
        +-- zod validation
        +-- createServiceRoleClient() --> UPDATE product_variants
```
