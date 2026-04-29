"use client"

import { useState, useEffect } from "react"
import type { ClientVariant } from "@/lib/data"

interface Props {
  variants: ClientVariant[]
  selectedVariant: ClientVariant | null
  onSelect: (v: ClientVariant) => void
  hasVariants: boolean
}

type AxisKey = 'coloris' | 'dimensions' | 'finition' | 'structure' | 'pietement'

// `structure` et `pietement` vivent dans specifications, les autres sont des
// colonnes directes.
const AXIS_DEFAULT_LABELS: Record<AxisKey, string> = {
  coloris:    'Couleur',
  dimensions: 'Dimension',
  finition:   'Finition',
  structure:  'Structure',
  pietement:  'Piètement',
}

const AXES: Array<{ key: AxisKey; label: string; get: (v: ClientVariant) => string }> = [
  { key: 'coloris',    label: AXIS_DEFAULT_LABELS.coloris,    get: (v) => v.coloris },
  { key: 'dimensions', label: AXIS_DEFAULT_LABELS.dimensions, get: (v) => v.dimensions },
  { key: 'finition',   label: AXIS_DEFAULT_LABELS.finition,   get: (v) => v.finition },
  { key: 'structure',  label: AXIS_DEFAULT_LABELS.structure,  get: (v) => v.specifications?.Structure || '' },
  { key: 'pietement',  label: AXIS_DEFAULT_LABELS.pietement,  get: (v) => v.specifications?.Piètement || '' },
]

// Mapping RAL / nom → couleur hex pour les swatches
const RAL_COLORS: Record<string, string> = {
  'gris procity':    '#8c8c8c',
  'gris procity®':   '#8c8c8c',
  '9010':            '#f4f4f4',
  'blanc':           '#f4f4f4',
  '9005':            '#0a0a0a',
  '9017':            '#1e1e1e',
  'noir':            '#0a0a0a',
  '3000':            '#ab2524',
  '3004':            '#8b1a1a',
  '3005':            '#5e2028',
  '3020':            '#cc2222',
  '2009':            '#e25303',
  '1016':            '#ead028',
  '1021':            '#f3b800',
  '1023':            '#f9b200',
  '1028':            '#f5a623',
  '1034':            '#efa94a',
  '5010':            '#1a5fa8',
  '5013':            '#193153',
  '5015':            '#3b83bd',
  '5018':            '#0e7c8b',
  '5024':            '#5b7e96',
  '4005':            '#6c4675',
  '4008':            '#844c82',
  '6005':            '#2b5c33',
  '6018':            '#57a639',
  '6024':            '#308446',
  '7001':            '#8c9ca5',
  '7016':            '#383e42',
  '7035':            '#cdd1c4',
  '7039':            '#6b6b60',
  '7040':            '#9da3a5',
  '7044':            '#b3b0a7',
  '9006':            '#a5a9ad',
  '8017':            '#4d2c1a',
  '8023':            '#a65e2f',
  'aspect corten':   '#a0522d',
  'corten':          '#a0522d',
  'galva':           '#c0c0c0',
  'galvanisé':       '#c0c0c0',
  'anodisé':         '#b8b8c8',
  'inox':            '#d4d4d4',
  'brut':            '#c8b89a',
  'gris métallisé':  '#8c9aaa',
  'lasure marron':   '#7b4b2a',
  'rouge':           '#cc2222',
  'bleu':            '#1a5fa8',
  'vert':            '#2b5c33',
  'jaune':           '#f9b200',
  'marron':          '#7b4b2a',
  'standard':        '#8c8c8c',
}

function getColorHex(coloris: string): string | null {
  const key = coloris.toLowerCase().trim().replace(/^ral\s+/, '')
  return RAL_COLORS[key] ?? null
}

export function VariantSelector({ variants, selectedVariant, onSelect }: Props) {
  const [selections, setSelections] = useState<Partial<Record<AxisKey, string>>>({})

  useEffect(() => {
    if (selectedVariant) {
      const newSel: Partial<Record<AxisKey, string>> = {}
      AXES.forEach(({ key, get }) => {
        const v = get(selectedVariant)
        if (v) newSel[key] = v
      })
      setSelections(newSel)
    }
  }, [selectedVariant])

  if (variants.length === 0) return null

  // Auto-détection du label pour l'axe `finition` selon les valeurs présentes.
  // Permet d'afficher « Vitrage » pour Vitrine 2000, « Crosse » pour les panneaux,
  // « Fixation » pour les arceaux/poteaux (scellement/platines) sans casser les autres familles.
  const finitionValues = variants.map(v => v.finition).filter(Boolean).join(' ').toLowerCase()
  const finitionLabel = /plexichocs|verre sécurisé/.test(finitionValues)
    ? 'Vitrage'
    : /crosse/.test(finitionValues)
    ? 'Crosse'
    : /scellement|platine/.test(finitionValues)
    ? 'Fixation'
    : AXIS_DEFAULT_LABELS.finition

  // Axes actifs = ceux qui ont au moins 2 valeurs distinctes non vides
  const activeAxes = AXES.filter(({ get }) => {
    const uniqueValues = new Set(variants.map(v => get(v)).filter(Boolean))
    return uniqueValues.size > 1
  }).map(axis => axis.key === 'finition' ? { ...axis, label: finitionLabel } : axis)

  const colorisActive = activeAxes.find(a => a.key === 'coloris')
  const dropdownAxes  = activeAxes.filter(a => a.key !== 'coloris')

  const matches = (v: ClientVariant, sels: Partial<Record<AxisKey, string>>) =>
    activeAxes.every(({ key, get }) => !sels[key] || get(v) === sels[key])

  const handleSelect = (axisKey: AxisKey, value: string) => {
    const newSelections = { ...selections, [axisKey]: value }
    setSelections(newSelections)

    const compatible = variants.filter(v => matches(v, newSelections))
    if (compatible.length === 0) return

    // Sélectionner la première variante compatible dès qu'un axe change — garantit
    // que l'image / le prix / la ref correspondent aux sélections en cours,
    // même quand tous les axes ne sont pas encore renseignés.
    onSelect(compatible[0])
  }

  // Fallback si aucun axe ne différencie
  if (activeAxes.length === 0) {
    // Si une seule variante (produit simple) : pas de sélecteur — la variante est
    // déjà auto-sélectionnée par le parent.
    if (variants.length <= 1) return null

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
            .filter(v => dropdownAxes.every(({ key, get }) =>
              !selections[key] || get(v) === selections[key]
            ))
            .map(v => v.coloris)
            .filter(Boolean)
        )]
        if (values.length === 0) return null

        return (
          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-2.5">Couleur</p>
            <div className="grid grid-cols-2 gap-1.5">
              {values.map(value => {
                const hex = getColorHex(value)
                const isSelected = selections.coloris === value
                const label = value === 'Standard' ? 'Gris Standard'
                  : value.toLowerCase().includes('corten') ? 'Aspect Corten'
                  : value.toLowerCase().includes('gris procity') ? 'Gris Procity'
                  : /^\d{4}$/.test(value) ? `RAL ${value}`
                  : value

                return (
                  <button
                    key={value}
                    onClick={() => handleSelect('coloris', value)}
                    title={label}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-all cursor-pointer ring-1 ${
                      isSelected
                        ? 'ring-accent bg-accent/5 font-medium text-foreground'
                        : 'ring-border/40 bg-secondary/10 text-foreground hover:ring-accent/40 hover:bg-secondary/20'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded flex-shrink-0 ring-1 ring-inset ring-black/10 ${!hex ? 'bg-secondary/40' : ''}`}
                      style={hex ? { backgroundColor: hex } : undefined}
                    />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Dropdowns dimensions + finition + structure ── */}
      {dropdownAxes.map(({ key, label, get }) => {
        const values = [...new Set(
          variants
            .filter(v => activeAxes.every(({ key: k, get: g }) =>
              k === key || !selections[k] || g(v) === selections[k]
            ))
            .map(v => get(v))
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
