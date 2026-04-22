'use client'

import { Pencil } from 'lucide-react'
import { useAdminRole } from '@/hooks/useAdminRole'

interface CategoryEditButtonProps {
  onEdit: () => void
}

export function CategoryEditButton({ onEdit }: CategoryEditButtonProps) {
  const { isAdmin, loading } = useAdminRole()

  if (loading || !isAdmin) return null

  return (
    <button
      onClick={onEdit}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent/10 text-accent border border-accent/20 rounded-lg hover:bg-accent/20 transition-colors"
      aria-label="Modifier la catégorie"
    >
      <Pencil size={12} />
      Modifier
    </button>
  )
}
