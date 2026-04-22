'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { CategoryEditButton } from '@/components/catalogue/category-edit-button'
import { CategoryEditPanel } from '@/components/catalogue/category-edit-panel'
import type { ClientCategory } from '@/lib/data'

interface CategoryPageClientProps {
  initialCategory: ClientCategory
  children: ReactNode
}

export function CategoryPageClient({ initialCategory, children }: CategoryPageClientProps) {
  const [category, setCategory] = useState(initialCategory)
  const [isEditing, setIsEditing] = useState(false)

  return (
    <>
      <div className="fixed top-4 right-4 z-30">
        <CategoryEditButton onEdit={() => setIsEditing(true)} />
      </div>

      {children}

      <CategoryEditPanel
        category={category}
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        onSaved={(updated) => {
          setCategory(updated)
          setIsEditing(false)
        }}
      />
    </>
  )
}
