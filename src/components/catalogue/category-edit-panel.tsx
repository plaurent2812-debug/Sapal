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
      const rawExt = file.name.split('.').pop()?.toLowerCase()
      const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']
      if (!rawExt || !allowedExts.includes(rawExt)) {
        setError('Format non supporté. Utilisez JPG, PNG, WEBP, GIF ou AVIF.')
        setUploading(false)
        return
      }
      const ext = rawExt
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
      if (fileInputRef.current) fileInputRef.current.value = ''
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
    try {
      const result = await updateCategory(category.id, payload)
      if (result.error) {
        setError(result.error)
        return
      }
      onSaved({ ...category, name: payload.name, slug: payload.slug, description: payload.description, imageUrl: payload.image_url, sortOrder: payload.sort_order, universe: result.universe ?? payload.universe ?? category.universe })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

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

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Image</label>
            {imageUrl && (
              <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border bg-secondary/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Aperçu" className="w-full h-full object-contain p-2" />
              </div>
            )}
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Ordre d'affichage</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              min={0}
              className="w-32 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

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
