'use client'

import { Pencil, PencilOff } from 'lucide-react'
import { useEditMode } from './EditModeProvider'

export function EditModeToggle() {
  const { isAdmin, adminLoading, isEditMode, toggleEditMode } = useEditMode()

  if (adminLoading || !isAdmin) return null

  return (
    <button
      onClick={toggleEditMode}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
        isEditMode
          ? 'bg-accent text-accent-foreground border-accent'
          : 'bg-accent/10 text-accent border-accent/30 hover:bg-accent/20'
      }`}
      aria-label={isEditMode ? 'Désactiver le mode édition' : 'Activer le mode édition'}
      title={isEditMode ? 'Mode édition actif' : 'Activer le mode édition'}
    >
      {isEditMode ? <PencilOff size={14} /> : <Pencil size={14} />}
      <span className="hidden sm:inline">{isEditMode ? 'Édition ON' : 'Édition'}</span>
    </button>
  )
}
