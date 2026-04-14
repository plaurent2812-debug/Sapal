"use client"

import { useState, useEffect } from "react"
import type { ClientVariant } from "@/lib/data"

interface Props {
  variants: ClientVariant[]
  selectedVariant: ClientVariant | null
  onSelect: (v: ClientVariant) => void
  hasVariants: boolean
}

type AxisKey = 'dimensions' | 'finition' | 'coloris'

const AXES: Array<{ key: AxisKey; label: string }> = [
  { key: 'coloris',    label: 'Couleur' },
  { key: 'dimensions', label: 'Longueur' },
  { key: 'finition',   label: 'Finition' },
]

// Mapping RAL / nom → couleur hex pour les swatches
const RAL_COLORS: Record<string, string> = {
  // Gris Procity
  'gris procity':    '#8c8c8c',
  'gris procity®':   '#8c8c8c',
  // Blancs
  '9010':            '#f4f4f4',
  'blanc':           '#f4f4f4',
  // Noirs
  '9005':            '#0a0a0a',
  'noir':            '#0a0a0a',
  // Rouges
  '3004':            '#8b1a1a',
  '3020':            '#cc2222',
  '3000':            '#ab2524',
  // Bleus
  '5010':            '#1a5fa8',
  '5015':            '#3b83bd',
  // Verts
  '6005':            '#2b5c33',
  '6018':            '#57a639',
  // Jaunes
  '1023':            '#f9b200',
  '1021':            '#f3b800',
  // Gris
  '7035':            '#cdd1c4',
  '7016':            '#383e42',
  '7044':            '#b3b0a7',
  // Bruns
  '8017':            '#4d2c1a',
  // Corton / aspect
  'aspect corten':   '#a0522d',
  'corten':          '#a0522d',
  // Finitions métal
  'galva':           '#c0c0c0',
  'galvanisé':       '#c0c0c0',
  'anodisé':         '#b8b8c8',
  'inox':            '#d4d4d4',
  'brut':            '#c8b89a',
  'gris métallisé':  '#8c9aaa',
  // Standard (gris Procity par défaut)
  'standard':        '#8c8c8c',
}

function getColorHex(coloris: string): string | null {
  const key = coloris.toLowerCase().trim()
  return RAL_COLORS[key] ?? null
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 160
}

export function VariantSelector({ variants, selectedVariant, onSelect }: Props) {
  const [selections, setSelections] = useState<Partial<Record<AxisKey, string>>>({})

  useEffect(() => {
    if (selectedVariant) {
      const newSel: Partial<Record<AxisKey, string>> = {}
      AXES.forEach(({ key }) => {
        if (selectedVariant[key]) newSel[key] = selectedVariant[key]
      })
      setSelections(newSel)
    }
  }, [selectedVariant])

  if (variants.length === 0) return null

  // Axes actifs = ceux qui ont au moins 2 valeurs distinctes non vides
  const activeAxes = AXES.filter(({ key }) => {
    const uniqueValues = new Set(variants.map(v => v[key]).filter(Boolean))
    return uniqueValues.size > 1
  })

  // Coloris actifs → swatches ; autres axes actifs → dropdowns
  const colorisActive = activeAxes.find(a => a.key === 'coloris')
  const dropdownAxes  = activeAxes.filter(a => a.key !== 'coloris')

  const handleSelect = (axis: AxisKey, value: string) => {
    const newSelections = { ...selections, [axis]: value }
    setSelections(newSelections)

    const compatible = variants.filter(v =>
      activeAxes.every(({ key }) => !newSelections[key] || v[key] === newSelections[key])
    )

    const allAxesSelected = activeAxes.every(({ key }) => newSelections[key])
    if (compatible.length === 1 || (compatible.length > 0 && allAxesSelected)) {
      onSelect(compatible[0])
    }
  }

  // Fallback si aucun axe ne différencie
  if (activeAxes.length === 0) {
    return (
      <div className="mb-6">
        <p className="text-sm font-semibold text-muted-foreground mb-2">Déclinaison</p>
        <select
          value={selectedVariant?.id || ''}
          onChange={(e) => {
            const v = variants.find(v => v.id === e.target.value)
            if (v) onSelect(v)
          }}
          className="w-full text-sm rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">Choisir une déclinaison...</option>
          {variants.map(v => (
            <option key={v.id} value={v.id}>
              {v.label}{v.price > 0 ? ` — ${v.price.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : ''}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="space-y-5 mb-6">

      {/* ── Swatches couleur ── */}
      {colorisActive && (() => {
        const values = [...new Set(
          variants
            .filter(v => dropdownAxes.every(({ key }) =>
              !selections[key] || v[key] === selections[key]
            ))
            .map(v => v.coloris)
            .filter(Boolean)
        )]
        if (values.length === 0) return null

        const hasAnyColor = values.some(c => getColorHex(c) !== null)

        return (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <p className="text-sm font-semibold text-muted-foreground">Couleur</p>
              {selections.coloris && (
                <span className="text-sm font-medium text-foreground">
                  {selections.coloris === 'Standard' ? 'Gris Standard' : `RAL ${selections.coloris}`}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {values.map(value => {
                const hex = getColorHex(value)
                const isSelected = selections.coloris === value
                const light = hex ? isLight(hex) : false

                return (
                  <button
                    key={value}
                    onClick={() => handleSelect('coloris', value)}
                    title={value === 'Standard' ? 'Gris Standard' : `RAL ${value}`}
                    className={`
                      relative transition-all cursor-pointer flex-shrink-0
                      ${hasAnyColor && hex
                        ? `w-9 h-9 rounded-lg ring-2 ring-offset-2 ${isSelected ? 'ring-accent scale-110' : 'ring-transparent hover:ring-accent/50'}`
                        : `px-3 py-1.5 rounded-lg text-sm font-medium ring-1 ${isSelected ? 'ring-accent bg-accent/10 text-accent' : 'ring-border/50 bg-secondary/30 text-foreground hover:ring-accent/50'}`
                      }
                    `}
                    style={hasAnyColor && hex ? { backgroundColor: hex } : undefined}
                    aria-pressed={isSelected}
                  >
                    {hasAnyColor && hex ? (
                      isSelected && (
                        <span
                          className={`absolute inset-0 flex items-center justify-center text-base font-bold ${light ? 'text-black/60' : 'text-white/80'}`}
                          aria-hidden
                        >
                          ✓
                        </span>
                      )
                    ) : (
                      value
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Dropdowns dimensions + finition ── */}
      {dropdownAxes.map(({ key, label }) => {
        const values = [...new Set(
          variants
            .filter(v => activeAxes.every(({ key: k }) =>
              k === key || !selections[k] || v[k] === selections[k]
            ))
            .map(v => v[key])
            .filter(Boolean)
        )]
        if (values.length === 0) return null

        return (
          <div key={key}>
            <p className="text-sm font-semibold text-muted-foreground mb-2">{label}</p>
            <select
              value={selections[key] ?? ''}
              onChange={(e) => handleSelect(key, e.target.value)}
              className="w-full text-sm rounded-xl border border-border/50 bg-secondary/20 px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
            >
              <option value="">Choisir…</option>
              {values.map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        )
      })}

    </div>
  )
}
