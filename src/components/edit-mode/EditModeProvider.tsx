'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAdminRole } from '@/hooks/useAdminRole'
import type { ContentValue } from '@/lib/site-content/types'

// -- État par clé : { currentValue, basePublishedValue, draftValue, page } --

interface ContentEntry {
  page: string
  publishedValue: ContentValue // valeur publique
  draftValue: ContentValue     // null si pas de brouillon, sinon dernière valeur enregistrée
}

interface UndoEntry {
  key: string
  previousValue: ContentValue // valeur restaurable en cas d'undo
}

interface EditModeContextValue {
  isAdmin: boolean
  adminLoading: boolean
  isEditMode: boolean
  toggleEditMode: () => void

  registerKey: (key: string, page: string, fallback: ContentValue) => void

  getValue: (key: string) => ContentValue | undefined
  hasDraft: (key: string) => boolean

  saveDraft: (key: string, page: string, value: ContentValue) => Promise<void>
  publishAll: () => Promise<{ ok: boolean; count: number; error?: string }>
  discardAll: () => Promise<void>
  undoLast: () => Promise<void>

  uploadImage: (file: File, page: string) => Promise<string>

  draftCount: number
  canUndo: boolean
  savingKey: string | null
}

const EditModeContext = createContext<EditModeContextValue | null>(null)

const STORAGE_KEY = 'sapal.editMode'

// -- Provider --

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading: adminLoading } = useAdminRole()

  const [isEditMode, setIsEditMode] = useState(false)
  const [entries, setEntries] = useState<Record<string, ContentEntry>>({})
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const loadedRef = useRef(false)

  // Restore localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(STORAGE_KEY) === 'on') setIsEditMode(true)
  }, [])

  // Charge les valeurs depuis BDD quand mode édition activé pour un admin
  useEffect(() => {
    if (!isAdmin || !isEditMode || loadedRef.current) return
    loadedRef.current = true

    fetch('/api/admin/site-content')
      .then(r => r.json())
      .then((data: { rows: { key: string; page: string; published_value: ContentValue; draft_value: ContentValue }[] }) => {
        setEntries(prev => {
          const next = { ...prev }
          for (const row of data.rows ?? []) {
            next[row.key] = {
              page: row.page,
              publishedValue: row.published_value,
              draftValue: row.draft_value,
            }
          }
          return next
        })
      })
      .catch(err => console.error('[edit-mode] load error', err))
  }, [isAdmin, isEditMode])

  const toggleEditMode = useCallback(() => {
    setIsEditMode(v => {
      const nv = !v
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, nv ? 'on' : 'off')
      }
      if (!nv) {
        // reset undo stack à l'extinction
        setUndoStack([])
      }
      return nv
    })
  }, [])

  const registerKey = useCallback((key: string, page: string, fallback: ContentValue) => {
    setEntries(prev => {
      if (prev[key]) return prev // déjà enregistrée
      return {
        ...prev,
        [key]: { page, publishedValue: fallback, draftValue: null },
      }
    })
  }, [])

  const getValue = useCallback((key: string): ContentValue | undefined => {
    const entry = entries[key]
    if (!entry) return undefined
    if (isEditMode && entry.draftValue !== null && entry.draftValue !== undefined) {
      return entry.draftValue
    }
    return entry.publishedValue
  }, [entries, isEditMode])

  const hasDraft = useCallback((key: string): boolean => {
    const entry = entries[key]
    return !!entry && entry.draftValue !== null && entry.draftValue !== undefined
  }, [entries])

  const saveDraft = useCallback(async (key: string, page: string, value: ContentValue) => {
    const previous = entries[key]?.draftValue ?? entries[key]?.publishedValue ?? null

    // optimistic update
    setEntries(prev => ({
      ...prev,
      [key]: {
        page,
        publishedValue: prev[key]?.publishedValue ?? null,
        draftValue: value,
      },
    }))
    setUndoStack(stack => [...stack, { key, previousValue: previous }])
    setSavingKey(key)

    try {
      const res = await fetch(`/api/admin/site-content/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
    } catch (err) {
      console.error('[edit-mode] save draft error', err)
      // rollback optimistic
      setEntries(prev => ({
        ...prev,
        [key]: {
          page,
          publishedValue: prev[key]?.publishedValue ?? null,
          draftValue: previous,
        },
      }))
      setUndoStack(stack => stack.slice(0, -1))
      throw err
    } finally {
      setSavingKey(null)
    }
  }, [entries])

  const publishAll = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/site-content/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur' }))
        return { ok: false, count: 0, error: err.error }
      }
      const data = (await res.json()) as { publishedCount: number }

      // Promote drafts → published localement
      setEntries(prev => {
        const next: Record<string, ContentEntry> = {}
        for (const [k, entry] of Object.entries(prev)) {
          if (entry.draftValue !== null && entry.draftValue !== undefined) {
            next[k] = { ...entry, publishedValue: entry.draftValue, draftValue: null }
          } else {
            next[k] = entry
          }
        }
        return next
      })
      setUndoStack([])

      return { ok: true, count: data.publishedCount }
    } catch (err) {
      console.error('[edit-mode] publish error', err)
      return { ok: false, count: 0, error: (err as Error).message }
    }
  }, [])

  const discardAll = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/site-content/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Erreur discard')

      setEntries(prev => {
        const next: Record<string, ContentEntry> = {}
        for (const [k, entry] of Object.entries(prev)) {
          next[k] = { ...entry, draftValue: null }
        }
        return next
      })
      setUndoStack([])
    } catch (err) {
      console.error('[edit-mode] discard error', err)
    }
  }, [])

  const undoLast = useCallback(async () => {
    if (undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    const entry = entries[last.key]
    if (!entry) return

    const pageOfEntry = entry.page

    // Restore localement + PATCH vers BDD
    setUndoStack(stack => stack.slice(0, -1))

    try {
      const res = await fetch(`/api/admin/site-content/${encodeURIComponent(last.key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pageOfEntry, value: last.previousValue }),
      })
      if (!res.ok) throw new Error('Erreur undo')

      setEntries(prev => ({
        ...prev,
        [last.key]: {
          ...(prev[last.key] ?? { page: pageOfEntry, publishedValue: null, draftValue: null }),
          draftValue: last.previousValue,
        },
      }))
    } catch (err) {
      console.error('[edit-mode] undo error', err)
      // re-push sur la stack
      setUndoStack(stack => [...stack, last])
    }
  }, [undoStack, entries])

  const uploadImage = useCallback(async (file: File, page: string): Promise<string> => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('page', page)

    const res = await fetch('/api/admin/site-content/upload-image', {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur' }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    const data = (await res.json()) as { url: string }
    return data.url
  }, [])

  const draftCount = useMemo(
    () => Object.values(entries).filter(e => e.draftValue !== null && e.draftValue !== undefined).length,
    [entries]
  )

  const value = useMemo<EditModeContextValue>(() => ({
    isAdmin,
    adminLoading,
    isEditMode,
    toggleEditMode,
    registerKey,
    getValue,
    hasDraft,
    saveDraft,
    publishAll,
    discardAll,
    undoLast,
    uploadImage,
    draftCount,
    canUndo: undoStack.length > 0,
    savingKey,
  }), [
    isAdmin, adminLoading, isEditMode, toggleEditMode,
    registerKey, getValue, hasDraft, saveDraft,
    publishAll, discardAll, undoLast, uploadImage,
    draftCount, undoStack.length, savingKey,
  ])

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>
}

export function useEditMode(): EditModeContextValue {
  const ctx = useContext(EditModeContext)
  if (!ctx) {
    throw new Error('useEditMode doit être utilisé dans un <EditModeProvider>')
  }
  return ctx
}

/**
 * Hook pour un wrapper : enregistre la clé avec sa valeur par défaut au mount,
 * retourne la valeur courante (draft ou published) et l'état admin/edit.
 */
export function useEditableValue<T extends ContentValue>(
  key: string,
  page: string,
  defaultValue: T
): { value: T; isEditMode: boolean; isAdmin: boolean; hasDraft: boolean } {
  const ctx = useContext(EditModeContext)

  // Sans provider (ex: rendu SSR statique) → on renvoie le défaut
  useEffect(() => {
    ctx?.registerKey(key, page, defaultValue)
  }, [ctx, key, page, defaultValue])

  const current = ctx?.getValue(key)
  const value = (current !== undefined && current !== null ? current : defaultValue) as T

  return {
    value,
    isEditMode: ctx?.isEditMode ?? false,
    isAdmin: ctx?.isAdmin ?? false,
    hasDraft: ctx?.hasDraft(key) ?? false,
  }
}
