'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, GripVertical, Loader2, Plus, Trash2, X, UploadCloud, Link as LinkIcon } from 'lucide-react'
import type { ListItem, ListValue } from '@/lib/site-content/types'
import { useEditMode } from './EditModeProvider'

export type ListFieldType = 'text' | 'textarea' | 'image' | 'url'

export interface ListFieldSchema {
  name: string
  label: string
  type: ListFieldType
  placeholder?: string
}

interface EditableListPanelProps {
  open: boolean
  onClose: () => void
  title: string
  keyName: string
  page: string
  schema: ListFieldSchema[]
  initialItems: ListValue
  onSave: (items: ListValue) => Promise<void>
}

export function EditableListPanel({
  open,
  onClose,
  title,
  keyName,
  page,
  schema,
  initialItems,
  onSave,
}: EditableListPanelProps) {
  const { uploadImage } = useEditMode()
  const [items, setItems] = useState<ListValue>(initialItems)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0)
  const [uploadingIdx, setUploadingIdx] = useState<string | null>(null) // "idx:field"

  useEffect(() => {
    if (open) {
      setItems(initialItems.length > 0 ? initialItems : [])
      setError(null)
    }
  }, [open, initialItems])

  if (!open) return null

  const updateField = (idx: number, field: string, value: string) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }

  const addItem = () => {
    const empty: ListItem = {}
    for (const f of schema) empty[f.name] = ''
    setItems(prev => [...prev, empty])
    setExpandedIdx(items.length)
  }

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems(prev => {
      const next = [...prev]
      const swapIdx = idx + dir
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }

  const handleImageUpload = async (idx: number, field: string, file: File) => {
    const slotKey = `${idx}:${field}`
    setUploadingIdx(slotKey)
    try {
      const url = await uploadImage(file, page)
      updateField(idx, field, url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploadingIdx(null)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(items)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="fixed top-0 right-0 h-full w-full max-w-xl bg-background border-l border-border shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-heading text-lg font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{keyName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {items.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm">
              Aucun élément. Cliquez sur « Ajouter » ci-dessous.
            </div>
          )}

          {items.map((item, idx) => {
            const isExpanded = expandedIdx === idx
            const previewLabel =
              (item.title as string) ||
              (item.label as string) ||
              (item.name as string) ||
              `Élément ${idx + 1}`

            return (
              <div
                key={idx}
                className="border border-border rounded-xl overflow-hidden bg-card"
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <div className="flex flex-col">
                    <button
                      onClick={() => moveItem(idx, -1)}
                      disabled={idx === 0}
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                      aria-label="Monter"
                      title="Monter"
                    >
                      <GripVertical size={12} className="rotate-90" />
                    </button>
                    <button
                      onClick={() => moveItem(idx, 1)}
                      disabled={idx === items.length - 1}
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                      aria-label="Descendre"
                      title="Descendre"
                    >
                      <GripVertical size={12} className="rotate-90" />
                    </button>
                  </div>

                  <button
                    className="flex-1 flex items-center gap-2 text-left cursor-pointer"
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  >
                    <ChevronDown
                      size={14}
                      className={`transition-transform text-muted-foreground ${isExpanded ? '' : '-rotate-90'}`}
                    />
                    <span className="text-sm font-medium truncate">{previewLabel}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm('Supprimer cet élément ?')) removeItem(idx)
                    }}
                    className="text-destructive hover:bg-destructive/10 p-1.5 rounded cursor-pointer"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border bg-background">
                    {schema.map(field => {
                      const val = (item[field.name] ?? '') as string
                      const slotKey = `${idx}:${field.name}`
                      const uploading = uploadingIdx === slotKey

                      if (field.type === 'text') {
                        return (
                          <div key={field.name} className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                            <input
                              type="text"
                              value={val}
                              placeholder={field.placeholder}
                              onChange={e => updateField(idx, field.name, e.target.value)}
                              className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                          </div>
                        )
                      }
                      if (field.type === 'textarea') {
                        return (
                          <div key={field.name} className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                            <textarea
                              value={val}
                              rows={3}
                              placeholder={field.placeholder}
                              onChange={e => updateField(idx, field.name, e.target.value)}
                              className="flex w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                            />
                          </div>
                        )
                      }
                      if (field.type === 'url') {
                        return (
                          <div key={field.name} className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                              <LinkIcon size={11} /> {field.label}
                            </label>
                            <input
                              type="url"
                              value={val}
                              placeholder={field.placeholder || 'https://…'}
                              onChange={e => updateField(idx, field.name, e.target.value)}
                              className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                          </div>
                        )
                      }
                      if (field.type === 'image') {
                        return (
                          <div key={field.name} className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                            <div className="flex items-start gap-2">
                              {val && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={val}
                                  alt=""
                                  className="w-16 h-16 rounded-md object-cover border border-border flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 space-y-1.5">
                                <input
                                  type="url"
                                  value={val}
                                  placeholder="https://… ou téléverser"
                                  onChange={e => updateField(idx, field.name, e.target.value)}
                                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                <label className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 cursor-pointer">
                                  {uploading ? <Loader2 size={11} className="animate-spin" /> : <UploadCloud size={11} />}
                                  Téléverser…
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/jpeg,image/png,image/webp,image/avif"
                                    onChange={e => {
                                      const f = e.target.files?.[0]
                                      if (f) handleImageUpload(idx, field.name, f)
                                      e.target.value = ''
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={addItem}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium border-2 border-dashed border-border rounded-xl hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Ajouter un élément
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          {error && (
            <span className="text-xs text-destructive flex-1">{error}</span>
          )}
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted cursor-pointer disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
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
