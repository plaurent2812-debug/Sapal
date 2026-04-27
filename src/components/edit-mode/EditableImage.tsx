'use client'

import Image, { type ImageProps } from 'next/image'
import { useState } from 'react'
import { Camera } from 'lucide-react'
import type { ImageValue } from '@/lib/site-content/types'
import { useEditMode, useEditableValue } from './EditModeProvider'
import { EditableImageDialog } from './EditableImageDialog'

type EditableImageProps = {
  keyName: string
  page: string
  defaultUrl: string
  defaultAlt: string
} & Omit<ImageProps, 'src' | 'alt'>

export function EditableImage({
  keyName,
  page,
  defaultUrl,
  defaultAlt,
  className,
  ...imageProps
}: EditableImageProps) {
  const initial: ImageValue = { url: defaultUrl, alt: defaultAlt }
  const { value, isEditMode, isAdmin, hasDraft } = useEditableValue<ImageValue>(
    keyName,
    page,
    initial
  )
  const { saveDraft } = useEditMode()
  const [dialogOpen, setDialogOpen] = useState(false)

  const showEditUI = isAdmin && isEditMode

  const safeValue: ImageValue = {
    url: value?.url || defaultUrl,
    alt: value?.alt || defaultAlt,
  }

  const img = (
    <Image
      {...imageProps}
      src={safeValue.url}
      alt={safeValue.alt}
      className={className}
    />
  )

  if (!showEditUI) return img

  return (
    <>
      <div
        className={`relative group cursor-pointer w-full h-full ${hasDraft ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
        onClick={() => setDialogOpen(true)}
        role="button"
        tabIndex={0}
        aria-label="Modifier l'image"
      >
        {img}
        <div className="absolute inset-0 bg-accent/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 bg-white text-accent px-3 py-1.5 rounded-lg text-xs font-bold shadow">
            <Camera size={14} />
            Modifier
          </span>
        </div>
      </div>

      <EditableImageDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialValue={safeValue}
        page={page}
        onSave={async (newValue) => {
          await saveDraft(keyName, page, newValue)
        }}
      />
    </>
  )
}
