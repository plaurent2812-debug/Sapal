'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { ListValue } from '@/lib/site-content/types'
import { useEditMode, useEditableValue } from './EditModeProvider'
import { EditableListPanel, type ListFieldSchema } from './EditableListPanel'

interface EditableListProps {
  keyName: string
  page: string
  title?: string
  schema: ListFieldSchema[]
  /** Items actuels (rendu côté serveur à partir de la BDD ou du défaut) */
  defaultValue: ListValue
  /** Contenu visuel déjà rendu côté serveur */
  children: React.ReactNode
}

/**
 * Wrapper autour d'une liste déjà rendue. En mode édition admin, ajoute
 * un bouton "Modifier" qui ouvre un panneau pour éditer les items.
 * Les modifications sont sauvegardées en brouillon ; le rendu public
 * ne change qu'après `Publier` + rechargement de la page.
 */
export function EditableList({
  keyName,
  page,
  title,
  schema,
  defaultValue,
  children,
}: EditableListProps) {
  const { value, isEditMode, isAdmin, hasDraft } = useEditableValue<ListValue>(
    keyName,
    page,
    defaultValue
  )
  const { saveDraft } = useEditMode()
  const [panelOpen, setPanelOpen] = useState(false)

  const currentItems = (value && Array.isArray(value) && value.length > 0
    ? value
    : defaultValue) as ListValue

  if (!isAdmin || !isEditMode) return <>{children}</>

  return (
    <div
      className={`relative ${hasDraft ? 'ring-2 ring-amber-400 ring-offset-2 rounded-lg' : ''}`}
    >
      {children}

      <button
        onClick={() => setPanelOpen(true)}
        className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg hover:brightness-110 transition-all cursor-pointer"
      >
        <Pencil size={12} />
        {title ? `Modifier ${title}` : 'Modifier la liste'}
      </button>

      {hasDraft && (
        <div className="absolute top-12 right-2 z-10 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-1 rounded shadow">
          Brouillon — cliquez sur « Publier » pour appliquer
        </div>
      )}

      <EditableListPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={title ? `Modifier ${title}` : 'Modifier la liste'}
        keyName={keyName}
        page={page}
        schema={schema}
        initialItems={currentItems}
        onSave={async (newItems) => {
          await saveDraft(keyName, page, newItems)
        }}
      />
    </div>
  )
}
