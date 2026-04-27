'use client'

import { createElement, useCallback, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useEditMode, useEditableValue } from './EditModeProvider'

type EditableTag = keyof React.JSX.IntrinsicElements

interface EditableTextProps {
  keyName: string
  page: string
  defaultValue: string
  as?: EditableTag
  className?: string
  multiline?: boolean
  /** Si défini, permet de rendre des enfants React en mode non-édition (ex: <br/>) tout en conservant le texte comme valeur source */
  renderPublic?: (text: string) => React.ReactNode
}

export function EditableText({
  keyName,
  page,
  defaultValue,
  as,
  className,
  multiline = false,
  renderPublic,
}: EditableTextProps) {
  const Tag = as ?? 'span'
  const { value, isEditMode, isAdmin, hasDraft } = useEditableValue(
    keyName,
    page,
    defaultValue
  )
  const { saveDraft, savingKey } = useEditMode()
  const [editing, setEditing] = useState(false)
  const isSaving = savingKey === keyName

  const handleBlur = useCallback(async (e: React.FocusEvent<HTMLElement>) => {
    const next = (e.currentTarget.textContent ?? '').replace(/\u00a0/g, ' ')
    setEditing(false)
    if (next !== value) {
      try {
        await saveDraft(keyName, page, next)
      } catch (err) {
        alert((err as Error).message || 'Erreur de sauvegarde')
      }
    }
  }, [saveDraft, keyName, page, value])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.currentTarget.textContent = value ?? ''
      e.currentTarget.blur()
      setEditing(false)
    } else if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }, [value, multiline])

  // Rendu public (non admin / non edit mode)
  if (!isAdmin || !isEditMode) {
    return createElement(
      Tag,
      { className },
      renderPublic ? renderPublic(value as string) : (value as string)
    )
  }

  // Mode édition admin
  return createElement(
    Tag,
    {
      className: `${className ?? ''} relative outline-none transition-all ${
        editing
          ? 'ring-2 ring-accent ring-offset-2 bg-accent/5 rounded cursor-text'
          : 'hover:ring-2 hover:ring-accent/60 hover:ring-offset-1 hover:bg-accent/5 rounded cursor-text'
      } ${hasDraft ? 'ring-1 ring-amber-400 ring-offset-1' : ''}`,
      contentEditable: editing,
      suppressContentEditableWarning: true,
      onClick: () => !editing && setEditing(true),
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      'data-editable-key': keyName,
      title: isSaving ? 'Enregistrement…' : 'Cliquez pour éditer',
    },
    value as string
  )
}

/**
 * Helper pour badges d'édition (icône crayon visible au hover).
 * Pour l'instant géré via ring/outline dans EditableText.
 */
export function EditBadge() {
  return (
    <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground rounded-full p-1 shadow">
      <Pencil size={10} />
    </span>
  )
}
