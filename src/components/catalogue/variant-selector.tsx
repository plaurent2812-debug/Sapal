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
  // Corten / aspect
  'aspect corten':   '#a0522d',
  'corten':          '#a0522d',
  // Finitions métal
  'galva':           '#c0c0c0',
  'galvanisé':       '#c0c0c0',
  'anodisé':         '#b8b8c8',
  'inox':            '#d4d4d4',
  'brut':            '#c8b89a',
  'gris métallisé':  '#8c9aaa',
  'standard':        '#8c8c8c',
}

function getColorHex(coloris: string): string | null {
  return RAL_COLORS[coloris.toLowerCase().trim()] ?? null
}

/** Formate le label : "9010" → "RAL 9010", "Gris Procity" → "Gris Procity" */
function formatColorLabel(coloris: string): string {
  if (/^\d{4}$/.test(coloris.trim())) return `RAL ${coloris.trim()}`
  return coloris.trim()
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

  const colorisActive = activeAxes.find(a => a.key === 'coloris')
  const dropdownAxes  = activeAxes.filter(a => a.key !== 'coloris')

  const handleSelect = (axis: AxisKey, value: string) => {
    const newSelections = { ...selections, [axis]: value }
    setSelections(newSelections)

    const compatible = variants.filter(v =>
      activeAxes.every(({ key }) => !newSelections[key] || v[key] === newSelections[key])
    )
    if (compatible.length === 0) return

    const allAxesSelected = activeAxes.every(({ key }) => newSelections[key])

    // Sélection immédiate pour la couleur → met à jour l'image sans attendre les autres axes
    // Aussi si une seule variante compatible ou si tout est sélectionné
    if (axis === 'coloris' || compatible.length === 1 || allAxesSelected) {
      onSelect(compatible[0])
    }
  }

  // Fallback si aucun axe ne différencie
  if (activeAxes.length === 0) {
    return (
      <div className="mb-6">
        <p className="text-sm font-semibold mb-2">Déclinaison</p>
        <select
          value={selectedVariant?.id || ''}
          onChange={(e) => {
            const v = variants.find(v => v.id === e.target.value)
            if (v) onSelect(v)
          }}
          className="w-full text-sm rounded-xl border-2 border-border/50 bg-background px-3 py-2.5 text-foreground outline-none focus:border-accent transition-colors cursor-pointer"
        >
          <option value="">Choisir une déclinaison…</option>
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
    <div className="space-y-6 mb-6">

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

        return (
          <div>
            <p className="text-sm font-semibold mb-3">
              Couleur
              {selections.coloris && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — {formatColorLabel(selections.coloris)}
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {values.map(value => {
                const hex = getColorHex(value)
                const isSelected = selections.coloris === value
                const label = formatColorLabel(value)

                return (
                  <button
                    key={value}
                    onClick={() => handleSelect('coloris', value)}
                    title={label}
                    aria-pressed={isSelected}
                    className={`
                      flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all cursor-pointer text-left
                      ${isSelected
                        ? 'border-accent bg-accent/5 shadow-sm'
                        : 'border-border/50 bg-background hover:border-accent/40 hover:bg-secondary/20'
                      }
                    `}
                  >
                    <span
                      className="w-7 h-7 rounded-lg flex-shrink-0 border border-black/10"
                      style={{ backgroundColor: hex ?? '#e5e7eb' }}
                      aria-hidden
                    />
                    <span className={`text-xs font-medium leading-tight truncate ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {label}
                    </span>
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
            <p className="text-sm font-semibold mb-2">{label}</p>
            <select
              value={selections[key] ?? ''}
              onChange={(e) => handleSelect(key, e.target.value)}
              className="w-full text-sm rounded-xl border-2 border-border/50 bg-background px-3 py-2.5 text-foreground outline-none focus:border-accent transition-colors cursor-pointer hover:border-accent/40"
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
