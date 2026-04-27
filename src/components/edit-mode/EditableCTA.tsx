'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Loader2, Pencil, X } from 'lucide-react'
import type { CTAValue } from '@/lib/site-content/types'
import { useEditMode, useEditableValue } from './EditModeProvider'

interface EditableCTAProps {
  keyName: string
  page: string
  defaultLabel: string
  defaultHref: string
  className?: string
  children?: React.ReactNode // icônes/contenus additionnels rendus après le label
}

export function EditableCTA({
  keyName,
  page,
  defaultLabel,
  defaultHref,
  className,
  children,
}: EditableCTAProps) {
  const initial: CTAValue = { label: defaultLabel, href: defaultHref }
  const { value, isEditMode, isAdmin, hasDraft } = useEditableValue<CTAValue>(
    keyName,
    page,
    initial
  )
  const { saveDraft } = useEditMode()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [label, setLabel] = useState(value?.label ?? defaultLabel)
  const [href, setHref] = useState(value?.href ?? defaultHref)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const safe: CTAValue = {
    label: value?.label || defaultLabel,
    href: value?.href || defaultHref,
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    setLabel(safe.label)
    setHref(safe.href)
    setError(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!label.trim() || !href.trim()) {
      setError('Le libellé et l’URL sont requis')
      return
    }
    setSaving(true)
    try {
      await saveDraft(keyName, page, { label: label.trim(), href: href.trim() })
      setDialogOpen(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const link = (
    <Link href={safe.href} className={className}>
      {safe.label}
      {children}
    </Link>
  )

  if (!isAdmin || !isEditMode) return link

  return (
    <>
      <div className={`relative inline-flex ${hasDraft ? 'ring-2 ring-amber-400 ring-offset-1 rounded' : ''}`}>
        <Link
          href={safe.href}
          className={className}
          onClick={handleOpen}
        >
          {safe.label}
          {children}
        </Link>
        <button
          onClick={handleOpen}
          className="absolute -top-2 -right-2 bg-accent text-accent-foreground rounded-full p-1 shadow cursor-pointer"
          aria-label="Modifier le CTA"
        >
          <Pencil size={10} />
        </button>
      </div>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-heading text-lg font-semibold">Modifier le bouton</h3>
              <button
                onClick={() => setDialogOpen(false)}
                className="p-1 rounded hover:bg-muted cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Libellé</label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">URL (href)</label>
                <input
                  type="text"
                  value={href}
                  onChange={e => setHref(e.target.value)}
                  placeholder="/page ou https://…"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
              <button
                onClick={() => setDialogOpen(false)}
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
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
