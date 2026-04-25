'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight, Pencil, Trash2, Plus, GripVertical, Loader2, X, Check } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAdminRole } from '@/hooks/useAdminRole'
import { CategoryEditPanel } from './category-edit-panel'
import { createSubcategory, deleteSubcategory, reorderSubcategories } from '@/app/actions/categories'
import type { ClientCategory } from '@/lib/data'

interface SubcategoriesManagerProps {
  parentId: string
  parentSlug: string
  basePath: string // "/catalogue" ou "/catalogue/fournisseurs/procity"
  categories: ClientCategory[]
  thumbnails: Record<string, string>
}

export function SubcategoriesManager({
  parentId,
  parentSlug: _parentSlug,
  basePath,
  categories: initialChildren,
  thumbnails,
}: SubcategoriesManagerProps) {
  const { isAdmin, loading } = useAdminRole()
  const [items, setItems] = useState(initialChildren)
  const [editMode, setEditMode] = useState(false)
  const [editing, setEditing] = useState<ClientCategory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = items.findIndex(i => i.id === active.id)
    const newIdx = items.findIndex(i => i.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const newOrder = arrayMove(items, oldIdx, newIdx)
    setItems(newOrder)

    startTransition(async () => {
      const res = await reorderSubcategories(parentId, newOrder.map(i => i.id))
      if (res.error) {
        setError(res.error)
        setItems(items) // rollback
      }
    })
  }

  async function handleDelete(cat: ClientCategory) {
    if (!confirm(`Supprimer "${cat.name}" ?`)) return
    const res = await deleteSubcategory(cat.id)
    if (res.error) {
      setError(res.error)
      return
    }
    setItems(prev => prev.filter(i => i.id !== cat.id))
  }

  if (loading || !isAdmin) {
    // Rendu public (non-admin) : identique à l'existant
    return (
      <StaticSubcategoryGrid
        items={items}
        basePath={basePath}
        thumbnails={thumbnails}
      />
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl sm:text-2xl">Sous-catégories</h2>
        <button
          onClick={() => setEditMode(v => !v)}
          className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
            editMode
              ? 'bg-accent text-white border-accent'
              : 'border-border hover:bg-secondary/40'
          }`}
        >
          <Pencil size={14} />
          {editMode ? 'Terminer' : 'Mode édition'}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {editMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(child => (
                <SortableCard
                  key={child.id}
                  category={child}
                  thumbnail={thumbnails[child.id]}
                  onEdit={() => setEditing(child)}
                  onDelete={() => handleDelete(child)}
                />
              ))}
              <AddCard
                parentId={parentId}
                onCreated={(created) => setItems(prev => [...prev, created])}
              />
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <StaticSubcategoryGrid
          items={items}
          basePath={basePath}
          thumbnails={thumbnails}
        />
      )}

      {isPending && (
        <p className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          Enregistrement de l&apos;ordre...
        </p>
      )}

      {editing && (
        <CategoryEditPanel
          category={editing}
          isOpen={true}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function StaticSubcategoryGrid({
  items,
  basePath,
  thumbnails,
}: {
  items: ClientCategory[]
  basePath: string
  thumbnails: Record<string, string>
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((child) => (
        <Link
          key={child.id}
          href={`${basePath}/${child.slug}`}
          className="group flex items-center bg-white border border-border/60 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 rounded-xl p-4 overflow-hidden hover:-translate-y-1"
        >
          <div className="w-20 h-20 flex-shrink-0 bg-gradient-to-br from-secondary/40 to-secondary/10 rounded-lg flex items-center justify-center overflow-hidden mr-4 border border-border/30 relative">
            {(child.imageUrl || thumbnails[child.id]) ? (
              <Image
                src={child.imageUrl || thumbnails[child.id]}
                alt={child.name}
                fill
                sizes="80px"
                className="object-contain p-1 group-hover:scale-110 transition-transform duration-500"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-border text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 flex items-center justify-between">
            <h3 className="font-bold text-sm md:text-base leading-tight pr-2 group-hover:text-accent transition-colors">
              {child.name}
            </h3>
            <ChevronRight
              size={20}
              className="text-accent flex-shrink-0 -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
            />
          </div>
        </Link>
      ))}
    </div>
  )
}

function SortableCard({
  category,
  thumbnail,
  onEdit,
  onDelete,
}: {
  category: ClientCategory
  thumbnail?: string
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex items-center bg-white border border-border/60 rounded-xl p-4 overflow-hidden"
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 mr-2 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="Réordonner"
      >
        <GripVertical size={18} />
      </button>

      <div className="w-16 h-16 flex-shrink-0 bg-gradient-to-br from-secondary/40 to-secondary/10 rounded-lg flex items-center justify-center overflow-hidden mr-3 border border-border/30 relative">
        {(category.imageUrl || thumbnail) ? (
          <Image
            src={category.imageUrl || thumbnail || ''}
            alt={category.name}
            fill
            sizes="64px"
            className="object-contain p-1"
          />
        ) : (
          <div className="w-6 h-6 rounded bg-border" />
        )}
      </div>

      <h3 className="flex-1 font-bold text-sm leading-tight pr-2">
        {category.name}
      </h3>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Modifier"
          title="Modifier"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
          aria-label="Supprimer"
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function AddCard({
  parentId,
  onCreated,
}: {
  parentId: string
  onCreated: (c: ClientCategory) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setErr(null)
    const res = await createSubcategory({ parent_id: parentId, name: trimmed })
    setSaving(false)
    if (res.error) {
      setErr(res.error)
      return
    }
    if (res.id && res.slug) {
      onCreated({
        id: res.id,
        name: trimmed,
        slug: res.slug,
        description: '',
        imageUrl: '',
        parentId,
        level: 0,
        sortOrder: 999,
        universe: null,
      } as ClientCategory)
      setName('')
      setExpanded(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center justify-center gap-2 bg-secondary/10 border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 rounded-xl p-4 min-h-[96px] text-muted-foreground hover:text-accent transition-colors cursor-pointer"
      >
        <Plus size={20} />
        <span className="font-semibold text-sm">Ajouter une sous-catégorie</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 bg-white border border-accent rounded-xl p-4">
      <input
        autoFocus
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleCreate()
          if (e.key === 'Escape') {
            setExpanded(false)
            setName('')
            setErr(null)
          }
        }}
        placeholder="Nom de la sous-catégorie"
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCreate}
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 cursor-pointer"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Créer
        </button>
        <button
          onClick={() => {
            setExpanded(false)
            setName('')
            setErr(null)
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary/40 cursor-pointer"
        >
          <X size={14} />
          Annuler
        </button>
      </div>
    </div>
  )
}
