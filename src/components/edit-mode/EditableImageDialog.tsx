'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link as LinkIcon, Loader2, UploadCloud, X } from 'lucide-react'
import type { ImageValue } from '@/lib/site-content/types'
import { useEditMode } from './EditModeProvider'

interface EditableImageDialogProps {
  open: boolean
  onClose: () => void
  initialValue: ImageValue
  page: string
  onSave: (value: ImageValue) => Promise<void>
}

type Tab = 'upload' | 'url'

export function EditableImageDialog({
  open,
  onClose,
  initialValue,
  page,
  onSave,
}: EditableImageDialogProps) {
  const { uploadImage } = useEditMode()

  const [tab, setTab] = useState<Tab>('upload')
  const [url, setUrl] = useState(initialValue.url)
  const [alt, setAlt] = useState(initialValue.alt)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setUrl(initialValue.url)
      setAlt(initialValue.alt)
      setError(null)
      setTab('upload')
    }
  }, [open, initialValue])

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const uploaded = await uploadImage(file, page)
      setUrl(uploaded)
      setTab('upload')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }, [uploadImage, page])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleSave = async () => {
    if (!url.trim()) {
      setError('Une URL ou un fichier uploadé est requis')
      return
    }
    if (!alt.trim()) {
      setError("Le texte alternatif (alt) est requis")
      return
    }
    setSaving(true)
    try {
      await onSave({ url: url.trim(), alt: alt.trim() })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-background text-foreground rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-heading text-lg font-semibold">Modifier l&apos;image</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted cursor-pointer"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'upload'
                ? 'border-b-2 border-accent text-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <UploadCloud size={14} />
            Téléverser
          </button>
          <button
            onClick={() => setTab('url')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'url'
                ? 'border-b-2 border-accent text-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LinkIcon size={14} />
            URL
          </button>
        </div>

        {/* Contenu */}
        <div className="px-6 py-5 space-y-4">
          {tab === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl py-10 px-6 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-muted/50'
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 size={28} className="animate-spin" />
                  <span className="text-sm">Téléversement…</span>
                </div>
              ) : (
                <>
                  <UploadCloud size={32} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    Glisser-déposer une image
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ou cliquer pour parcourir votre ordinateur
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    JPEG, PNG, WebP ou AVIF · max 5 MB
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                  e.target.value = ''
                }}
              />
            </div>
          )}

          {tab === 'url' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">URL de l&apos;image</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://…"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
              />
            </div>
          )}

          {/* Preview */}
          {url && (
            <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={alt || 'Aperçu'}
                className="w-full h-40 object-cover"
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
              />
            </div>
          )}

          {/* Alt text (obligatoire) */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">
              Texte alternatif <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={alt}
              onChange={e => setAlt(e.target.value)}
              placeholder="Description de l'image pour l'accessibilité"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground">
              Décrit le contenu de l&apos;image pour les lecteurs d&apos;écran et le SEO.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted cursor-pointer disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Enregistrer le brouillon
          </button>
        </div>
      </div>
    </div>
  )
}
