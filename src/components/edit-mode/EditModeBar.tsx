'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Undo2, X } from 'lucide-react'
import { useEditMode } from './EditModeProvider'

export function EditModeBar() {
  const {
    isAdmin,
    adminLoading,
    isEditMode,
    draftCount,
    canUndo,
    undoLast,
    publishAll,
    discardAll,
  } = useEditMode()

  const [publishing, setPublishing] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; kind: 'success' | 'error' } | null>(null)

  if (adminLoading || !isAdmin || !isEditMode) return null

  const handlePublish = async () => {
    if (draftCount === 0) return
    const ok = window.confirm(`Publier ${draftCount} modification(s) ? Cette action les rendra visibles par tous les visiteurs.`)
    if (!ok) return
    setPublishing(true)
    const result = await publishAll()
    setPublishing(false)
    if (result.ok) {
      setFeedback({ message: `${result.count} modification(s) publiée(s)`, kind: 'success' })
    } else {
      setFeedback({ message: result.error || 'Erreur lors de la publication', kind: 'error' })
    }
    setTimeout(() => setFeedback(null), 3500)
  }

  const handleDiscard = async () => {
    if (draftCount === 0) return
    const ok = window.confirm(`Supprimer ${draftCount} brouillon(s) ? Tous les changements non publiés seront perdus.`)
    if (!ok) return
    await discardAll()
    setFeedback({ message: 'Brouillons supprimés', kind: 'success' })
    setTimeout(() => setFeedback(null), 2500)
  }

  return (
    <div
      role="region"
      aria-label="Barre d'édition"
      className="sticky top-0 z-[60] w-full bg-accent text-accent-foreground border-b border-accent shadow-sm"
    >
      <div className="mx-auto max-w-[1600px] px-4 md:px-8 lg:px-12 py-2 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          Mode édition actif
        </div>

        <div className="flex-1 min-w-[100px]">
          {draftCount > 0 ? (
            <span className="text-xs md:text-sm font-medium opacity-90">
              {draftCount} modification{draftCount > 1 ? 's' : ''} non publiée{draftCount > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-xs md:text-sm opacity-75">Aucune modification en attente</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={undoLast}
            disabled={!canUndo}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            aria-label="Annuler la dernière modification"
          >
            <Undo2 size={13} />
            <span className="hidden sm:inline">Annuler</span>
          </button>

          <button
            onClick={handleDiscard}
            disabled={draftCount === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <X size={13} />
            <span className="hidden sm:inline">Tout annuler</span>
          </button>

          <button
            onClick={handlePublish}
            disabled={publishing || draftCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md bg-white text-accent hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {publishing ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Publication…
              </>
            ) : (
              <>
                <CheckCircle2 size={13} />
                Publier{draftCount > 0 ? ` (${draftCount})` : ''}
              </>
            )}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mx-auto max-w-[1600px] px-4 md:px-8 lg:px-12 py-1.5 text-xs font-medium ${
            feedback.kind === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  )
}
