# Category Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un panneau latéral coulissant sur chaque page de catégorie (`/catalogue/[slug]`) permettant aux admins de modifier nom, slug, description, image et sort_order directement depuis la page publique.

**Architecture:** Nouveau composant client `CategoryEditPanel` rendu sur les pages de catégorie, déclenché par un bouton "Modifier" visible uniquement si l'utilisateur a le rôle `admin`. La sauvegarde passe par une Server Action qui vérifie la session côté serveur, met à jour Supabase, et invalide le cache Next.js via `revalidatePath`.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (browser client pour upload, server client pour la Server Action), Tailwind CSS 4, `lucide-react`

---

## File Map

| Fichier | Action | Rôle |
|---------|--------|------|
| `src/app/actions/categories.ts` | **Créer** | Server Action `updateCategory` — vérif session + update DB + revalidate |
| `src/components/catalogue/category-edit-panel.tsx` | **Créer** | Panneau coulissant avec formulaire d'édition |
| `src/components/catalogue/category-edit-button.tsx` | **Créer** | Bouton "Modifier" visible admins seulement, déclenche le panneau |
| `src/app/catalogue/[slug]/page.tsx` | **Modifier** | Convertir en client component, intégrer le panneau + bouton |

---

## Task 1 — Server Action `updateCategory`

**Files:**
- Create: `src/app/actions/categories.ts`

- [ ] **Créer le fichier Server Action**

```typescript
// src/app/actions/categories.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface UpdateCategoryPayload {
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  universe?: string
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session || session.user.user_metadata?.role !== 'admin') {
    return { error: 'Non autorisé' }
  }

  const { error } = await supabase
    .from('categories')
    .update({
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      image_url: payload.image_url,
      sort_order: payload.sort_order,
      ...(payload.universe !== undefined ? { universe: payload.universe } : {}),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/catalogue/${payload.slug}`, 'page')
  revalidatePath('/catalogue', 'page')

  return {}
}
```

- [ ] **Vérifier que le fichier compile sans erreur TypeScript**

```bash
cd "Site internet" && npx tsc --noEmit 2>&1 | head -30
```
Expected : aucune erreur liée à `src/app/actions/categories.ts`

- [ ] **Commit**

```bash
git checkout -b feat/category-editor
git add src/app/actions/categories.ts
git commit -m "feat: add updateCategory server action with auth check and revalidation"
```

---

## Task 2 — Composant `CategoryEditPanel`

**Files:**
- Create: `src/components/catalogue/category-edit-panel.tsx`

- [ ] **Créer le panneau d'édition**

```typescript
// src/components/catalogue/category-edit-panel.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Save, Loader2, Upload, Link as LinkIcon } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { generateSlug } from '@/lib/utils'
import { updateCategory, type UpdateCategoryPayload } from '@/app/actions/categories'
import type { ClientCategory } from '@/lib/data'

interface CategoryEditPanelProps {
  category: ClientCategory
  isOpen: boolean
  onClose: () => void
  onSaved: (updated: ClientCategory) => void
}

export function CategoryEditPanel({ category, isOpen, onClose, onSaved }: CategoryEditPanelProps) {
  const [name, setName] = useState(category.name)
  const [slug, setSlug] = useState(category.slug)
  const [description, setDescription] = useState(category.description ?? '')
  const [imageUrl, setImageUrl] = useState(category.imageUrl ?? '')
  const [sortOrder, setSortOrder] = useState(category.sortOrder ?? 0)
  const [universe, setUniverse] = useState(category.universe ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync state when category prop changes (e.g. after save)
  useEffect(() => {
    setName(category.name)
    setSlug(category.slug)
    setDescription(category.description ?? '')
    setImageUrl(category.imageUrl ?? '')
    setSortOrder(category.sortOrder ?? 0)
    setUniverse(category.universe ?? '')
    setError(null)
  }, [category])

  function handleNameChange(value: string) {
    setName(value)
    setSlug(generateSlug(value))
  }

  async function handleFileUpload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const supabase = createBrowserClient()
      const ext = file.name.split('.').pop()
      const path = `${category.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('categories')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('categories').getPublicUrl(path)
      setImageUrl(data.publicUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur upload')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!name.trim() || !slug.trim()) {
      setError('Le nom et le slug sont requis')
      return
    }
    setSaving(true)
    setError(null)
    const payload: UpdateCategoryPayload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      image_url: imageUrl.trim(),
      sort_order: sortOrder,
      ...(category.level === 1 ? { universe: universe.trim() || null } : {}),
    }
    const result = await updateCategory(category.id, payload)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onSaved({ ...category, ...payload, imageUrl: payload.image_url, sortOrder: payload.sort_order, universe: payload.universe ?? category.universe })
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-heading text-lg font-semibold">Modifier la catégorie</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary/60 transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Nom */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nom *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Nom de la catégorie"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Slug *</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="slug-de-la-categorie"
            />
            <p className="text-xs text-muted-foreground">URL : /catalogue/{slug}</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Description de la catégorie"
            />
          </div>

          {/* Image */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Image</label>

            {/* Preview */}
            {imageUrl && (
              <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border bg-secondary/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Aperçu" className="w-full h-full object-contain p-2" />
              </div>
            )}

            {/* Upload */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-secondary/40 transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Upload…' : 'Choisir un fichier'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                }}
              />
            </div>

            {/* URL manuelle */}
            <div className="flex items-center gap-2">
              <LinkIcon size={14} className="text-muted-foreground flex-shrink-0" />
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="https://... ou coller une URL"
              />
            </div>
          </div>

          {/* Sort order */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Ordre d'affichage</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              min={0}
              className="w-32 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {/* Universe (level 1 only) */}
          {category.level === 1 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Univers</label>
              <input
                type="text"
                value={universe}
                onChange={(e) => setUniverse(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="ex: Mobilier Urbain"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary/40 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Vérifier compilation**

```bash
cd "Site internet" && npx tsc --noEmit 2>&1 | head -30
```
Expected : aucune erreur liée à `category-edit-panel.tsx`

- [ ] **Commit**

```bash
git add src/components/catalogue/category-edit-panel.tsx
git commit -m "feat: add CategoryEditPanel slide-in component with image upload"
```

---

## Task 3 — Composant `CategoryEditButton`

**Files:**
- Create: `src/components/catalogue/category-edit-button.tsx`

- [ ] **Créer le bouton d'édition (visible admins uniquement)**

```typescript
// src/components/catalogue/category-edit-button.tsx
'use client'

import { useState, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

interface CategoryEditButtonProps {
  onEdit: () => void
}

export function CategoryEditButton({ onEdit }: CategoryEditButtonProps) {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.user_metadata?.role === 'admin') {
        setIsAdmin(true)
      }
    })
  }, [])

  if (!isAdmin) return null

  return (
    <button
      onClick={onEdit}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent/10 text-accent border border-accent/20 rounded-lg hover:bg-accent/20 transition-colors"
      aria-label="Modifier la catégorie"
    >
      <Pencil size={12} />
      Modifier
    </button>
  )
}
```

- [ ] **Vérifier compilation**

```bash
cd "Site internet" && npx tsc --noEmit 2>&1 | head -30
```
Expected : aucune erreur

- [ ] **Commit**

```bash
git add src/components/catalogue/category-edit-button.tsx
git commit -m "feat: add CategoryEditButton visible to admins only"
```

---

## Task 4 — Intégration dans `catalogue/[slug]/page.tsx`

**Files:**
- Modify: `src/app/catalogue/[slug]/page.tsx`

La page est actuellement un Server Component async. Pour gérer l'état `isEditing`, on extrait le contenu dans un Client Component wrapper, tout en gardant le fetch de données côté serveur.

- [ ] **Créer le client wrapper `CategoryPageClient`**

Créer un nouveau fichier :

```typescript
// src/components/catalogue/category-page-client.tsx
'use client'

import { useState } from 'react'
import { CategoryEditButton } from '@/components/catalogue/category-edit-button'
import { CategoryEditPanel } from '@/components/catalogue/category-edit-panel'
import type { ClientCategory } from '@/lib/data'

interface CategoryPageClientProps {
  initialCategory: ClientCategory
  children: React.ReactNode
}

export function CategoryPageClient({ initialCategory, children }: CategoryPageClientProps) {
  const [category, setCategory] = useState(initialCategory)
  const [isEditing, setIsEditing] = useState(false)

  return (
    <>
      {/* Bouton Modifier flottant en haut à droite */}
      <div className="fixed top-4 right-4 z-30">
        <CategoryEditButton onEdit={() => setIsEditing(true)} />
      </div>

      {children}

      <CategoryEditPanel
        category={category}
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        onSaved={(updated) => {
          setCategory(updated)
          setIsEditing(false)
        }}
      />
    </>
  )
}
```

- [ ] **Modifier `catalogue/[slug]/page.tsx` pour intégrer le wrapper**

Ajouter l'import en haut :

```typescript
import { CategoryPageClient } from '@/components/catalogue/category-page-client'
```

Wrapper le JSX retourné dans `CategoryPageClient` — remplacer le `return (` actuel par :

```typescript
  return (
    <CategoryPageClient initialCategory={category}>
      <div className="flex flex-col min-h-screen bg-background pb-20">
        {/* ... tout le contenu existant inchangé ... */}
      </div>
    </CategoryPageClient>
  )
```

Le reste du fichier (`generateMetadata`, les fetch, la logique hasChildren/products) reste **exactement identique**. Seul le `return` est wrappé.

- [ ] **Vérifier compilation**

```bash
cd "Site internet" && npx tsc --noEmit 2>&1 | head -30
```
Expected : aucune erreur

- [ ] **Vérifier que le build Next.js passe**

```bash
cd "Site internet" && npm run build 2>&1 | tail -20
```
Expected : `✓ Compiled successfully` ou similaire, aucune erreur

- [ ] **Commit**

```bash
git add src/components/catalogue/category-page-client.tsx src/app/catalogue/[slug]/page.tsx
git commit -m "feat: integrate category edit panel into catalogue slug page"
```

---

## Task 5 — Test manuel & vérification finale

- [ ] **Lancer le serveur de développement**

```bash
cd "Site internet" && npm run dev
```

- [ ] **Vérifier en tant qu'admin**

1. Se connecter sur `/admin/login` avec un compte admin
2. Naviguer vers `/catalogue/[un-slug-valide]`
3. Vérifier que le bouton "Modifier" apparaît en haut à droite
4. Cliquer "Modifier" → le panneau doit s'ouvrir avec les données pré-remplies
5. Modifier le nom → vérifier que le slug se met à jour automatiquement
6. Uploader une image → vérifier que l'aperçu se met à jour
7. Coller une URL image → vérifier que l'aperçu se met à jour
8. Cliquer "Enregistrer" → panneau se ferme, la page reflète les nouvelles données
9. Recharger la page → les données persistées sont correctes

- [ ] **Vérifier en tant que visiteur (non admin)**

1. Se déconnecter (ou naviguer en navigation privée)
2. Aller sur `/catalogue/[un-slug]`
3. Vérifier que le bouton "Modifier" **n'apparaît pas**

- [ ] **Vérifier la revalidation du cache**

Après une modification, vérifier dans les logs Vercel/Next.js que `revalidatePath` a bien été appelé (ou tester en prod/preview que la page publique reflète les changements).

- [ ] **Commit final**

```bash
git push origin feat/category-editor
```

---

## Checklist spec coverage

| Exigence spec | Tâche |
|--------------|-------|
| Panneau coulissant depuis la droite | Task 2 |
| Overlay sombre derrière | Task 2 |
| Champs : name, slug, description, image_url, sort_order | Task 2 |
| Champ universe conditionnel (level === 1) | Task 2 |
| Upload image vers Supabase Storage | Task 2 |
| URL manuelle image | Task 2 |
| Bouton visible admins uniquement | Task 3 |
| Intégration sur pages `/catalogue/[slug]` | Task 4 |
| Server Action avec vérif session | Task 1 |
| revalidatePath sur slug ET /catalogue | Task 1 |
| Sécurité : double vérif session | Task 1 + Task 3 |
