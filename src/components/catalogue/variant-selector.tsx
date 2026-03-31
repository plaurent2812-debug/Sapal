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
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'finition', label: 'Finition' },
  { key: 'coloris', label: 'Coloris' },
]

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

  // Fallback : si aucun axe ne différencie, afficher un dropdown par label
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

  const handleSelect = (axis: AxisKey, value: string) => {
    const newSelections = { ...selections, [axis]: value }
    setSelections(newSelections)

    const compatible = variants.filter(v =>
      activeAxes.every(({ key }) => !newSelections[key] || v[key] === newSelections[key])
    )

    if (compatible.length === 1) {
      onSelect(compatible[0])
    }
  }

  return (
    <div className="space-y-4 mb-6">
      {activeAxes.map(({ key, label }) => {
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
            <div className="flex flex-wrap gap-2">
              {values.map(value => {
                const isSelected = selections[key] === value
                return (
                  <button
                    key={value}
                    onClick={() => handleSelect(key, value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ring-1 ${
                      isSelected
                        ? 'ring-accent bg-accent/10 text-accent'
                        : 'ring-border/50 bg-secondary/30 text-foreground hover:ring-accent/50'
                    }`}
                  >
                    {value}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
