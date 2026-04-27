"use client"

import { useState } from "react"
import { useQuoteStore } from "@/store/useQuoteStore"
import { Plus, Check } from "lucide-react"
import type { ProductOption, ClientVariant } from "@/lib/data"

interface Props {
  options: ProductOption[]
}

function OptionRow({ option }: { option: ProductOption }) {
  const addItem = useQuoteStore((s) => s.addItem)
  const [selectedVariant, setSelectedVariant] = useState<ClientVariant | null>(
    option.variants.length === 1 ? option.variants[0] : null
  )
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const displayPrice = selectedVariant ? selectedVariant.price : option.product.price
  const displayRef = selectedVariant?.reference || option.product.reference

  const handleAdd = () => {
    addItem(option.product, quantity, selectedVariant?.id, selectedVariant?.label)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const canAdd = option.variants.length === 0 || selectedVariant !== null

  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-tight">{option.product.name}</p>
          {option.product.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{option.product.description}</p>
          )}
          {displayRef && (
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Réf. {displayRef}</p>
          )}
        </div>
        {displayPrice > 0 && (
          <p className="text-sm font-bold text-foreground whitespace-nowrap">
            {displayPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € <span className="text-[10px] font-normal text-muted-foreground">HT</span>
          </p>
        )}
      </div>

      {/* Variant dropdown si applicable */}
      {option.variants.length > 1 && (
        <select
          value={selectedVariant?.id || ''}
          onChange={(e) => {
            const v = option.variants.find(v => v.id === e.target.value) || null
            setSelectedVariant(v)
          }}
          className="w-full text-sm rounded-lg border border-border/50 bg-secondary/20 px-3 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">Choisir une déclinaison...</option>
          {option.variants.map(v => (
            <option key={v.id} value={v.id}>
              {v.label}{v.price > 0 ? ` — ${v.price.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : ''}
            </option>
          ))}
        </select>
      )}

      {/* Quantité + bouton ajouter */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-secondary/30 rounded-lg ring-1 ring-border/50">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-7 h-7 flex items-center justify-center text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40 rounded-l-lg text-xs"
            disabled={quantity <= 1}
          >
            −
          </button>
          <span className="w-8 h-7 text-center text-xs font-bold flex items-center justify-center border-x border-border/50">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="w-7 h-7 flex items-center justify-center text-foreground hover:bg-secondary transition-colors cursor-pointer rounded-r-lg text-xs"
          >
            +
          </button>
        </div>

        <button
          onClick={handleAdd}
          disabled={!canAdd || added}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            added
              ? 'bg-green-100/50 text-green-700'
              : canAdd
              ? 'bg-accent/10 text-accent hover:bg-accent/20 ring-1 ring-accent/30'
              : 'bg-secondary/30 text-muted-foreground cursor-not-allowed opacity-50'
          }`}
        >
          {added ? (
            <><Check size={14} /> Ajouté</>
          ) : (
            <><Plus size={14} /> Ajouter au devis</>
          )}
        </button>
      </div>
    </div>
  )
}

export function ProductOptionsSection({ options }: Props) {
  if (options.length === 0) return null

  return (
    <div className="mt-6 pt-6 border-t border-border/50">
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
        Options disponibles
      </h3>
      <div className="divide-y divide-border/30">
        {options.map((opt) => (
          <OptionRow key={opt.product.id} option={opt} />
        ))}
      </div>
    </div>
  )
}
