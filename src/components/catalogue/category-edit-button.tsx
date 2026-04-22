'use client'

import { useState, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

interface CategoryEditButtonProps {
  onEdit: () => void
}

export function CategoryEditButton({ onEdit }: CategoryEditButtonProps) {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.user_metadata?.role === 'admin') {
        setIsAdmin(true)
      }
    })
  }, [])

  if (!isAdmin) return null

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
