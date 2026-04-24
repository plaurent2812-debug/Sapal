'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

type CatalogueLink = {
  href: string
  label: string
  description?: string
}

const CATALOGUE_LINKS: CatalogueLink[] = [
  {
    href: '/catalogue',
    label: 'Tous nos produits',
    description: 'Parcourir l’intégralité du catalogue',
  },
  {
    href: '/catalogue/fournisseurs/procity',
    label: 'Catalogue Procity',
    description: 'Mobilier urbain premium',
  },
]

export function CatalogueDropdown() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fermeture au clic extérieur
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', onDocClick)
      document.addEventListener('keydown', onKey)
    }
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Petite temporisation à la sortie pour laisser le temps d'atteindre le menu
  function handleMouseEnter() {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
    setOpen(true)
  }
  function handleMouseLeave() {
    closeTimeout.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(v => !v)}
        className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-3 py-2 rounded-md hover:bg-white inline-flex items-center gap-1"
      >
        Catalogue
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu Catalogue"
          className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-xl py-2 z-50"
        >
          {CATALOGUE_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 hover:bg-background transition-colors"
            >
              <div className="text-sm font-semibold text-primary">{link.label}</div>
              {link.description && (
                <div className="text-xs text-foreground/60 mt-0.5">{link.description}</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
