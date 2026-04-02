"use client"

import { useState, useMemo } from "react"
import { ProductCard } from "@/components/catalogue/product-card"
import type { ClientProduct } from "@/lib/data"
import { ChevronDown } from "lucide-react"

const ALL_FAMILIES = "Toutes"
const ALL_TYPES = "Tous"

const SHEETS = [
  "MOBILIER URBAIN",
  "AIRES DE JEUX",
  "ÉQUIPEMENTS SPORTIFS",
  "MIROIRS",
] as const

type Sheet = typeof SHEETS[number]

interface Props {
  products: ClientProduct[]
}

export function ProcityCatalogueClient({ products }: Props) {
  const [activeSheet, setActiveSheet] = useState<Sheet>("MOBILIER URBAIN")
  const [activeFamily, setActiveFamily] = useState<string>(ALL_FAMILIES)
  const [activeType, setActiveType] = useState<string>(ALL_TYPES)

  // Comptages par onglet
  const sheetCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of products) {
      if (p.procitySheet) counts[p.procitySheet] = (counts[p.procitySheet] ?? 0) + 1
    }
    return counts
  }, [products])

  // Produits de l'onglet actif
  const sheetProducts = useMemo(
    () => products.filter((p) => p.procitySheet === activeSheet),
    [products, activeSheet]
  )

  // Familles disponibles pour l'onglet actif
  const families = useMemo(() => {
    const set = new Set(sheetProducts.map((p) => p.procityFamily).filter(Boolean) as string[])
    return [ALL_FAMILIES, ...Array.from(set).sort()]
  }, [sheetProducts])

  // Types disponibles pour la famille active
  const types = useMemo(() => {
    const source = activeFamily === ALL_FAMILIES ? sheetProducts : sheetProducts.filter((p) => p.procityFamily === activeFamily)
    const set = new Set(source.map((p) => p.procityType).filter(Boolean) as string[])
    return [ALL_TYPES, ...Array.from(set).sort()]
  }, [sheetProducts, activeFamily])

  // Produits filtrés finaux
  const filtered = useMemo(() => {
    return sheetProducts.filter((p) => {
      if (activeFamily !== ALL_FAMILIES && p.procityFamily !== activeFamily) return false
      if (activeType !== ALL_TYPES && p.procityType !== activeType) return false
      return true
    })
  }, [sheetProducts, activeFamily, activeType])

  function handleSheetChange(sheet: Sheet) {
    setActiveSheet(sheet)
    setActiveFamily(ALL_FAMILIES)
    setActiveType(ALL_TYPES)
  }

  function handleFamilyChange(family: string) {
    setActiveFamily(family)
    setActiveType(ALL_TYPES)
  }

  return (
    <div>
      {/* Onglets principaux */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-border/40 pb-1">
        {SHEETS.map((sheet) => {
          const count = sheetCounts[sheet] ?? 0
          return (
            <button
              key={sheet}
              onClick={() => handleSheetChange(sheet)}
              className={`relative px-5 py-3 text-sm font-bold uppercase tracking-wide transition-colors duration-200 cursor-pointer ${
                activeSheet === sheet
                  ? "text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-accent after:translate-y-[1px]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {sheet}
              {count > 0 && (
                <span className="ml-2 text-[10px] bg-secondary/60 text-muted-foreground px-1.5 py-0.5 rounded-full font-normal">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filtres en cascade */}
      <div className="flex flex-wrap gap-4 mb-8">
        {/* Dropdown Catégorie */}
        <div className="relative">
          <label htmlFor="filter-family" className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1.5">
            Catégorie
          </label>
          <div className="relative">
            <select
              id="filter-family"
              value={activeFamily}
              onChange={(e) => handleFamilyChange(e.target.value)}
              className="appearance-none bg-white border border-border/60 rounded-lg px-4 py-2.5 pr-9 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent cursor-pointer min-w-[220px]"
            >
              {families.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Dropdown Type de produit */}
        <div className="relative">
          <label htmlFor="filter-type" className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1.5">
            Type de produit
          </label>
          <div className="relative">
            <select
              id="filter-type"
              value={activeType}
              onChange={(e) => setActiveType(e.target.value)}
              disabled={types.length <= 1}
              className="appearance-none bg-white border border-border/60 rounded-lg px-4 py-2.5 pr-9 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent cursor-pointer min-w-[220px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Compteur résultats */}
        <div className="flex items-end pb-2.5">
          <span className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{filtered.length}</span> produit{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Grille produits */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium mb-2">Aucun produit trouvé pour cette sélection.</p>
          <button
            onClick={() => { setActiveFamily(ALL_FAMILIES); setActiveType(ALL_TYPES) }}
            className="text-accent hover:underline text-sm cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categorySlug={product.categorySlug ?? "procity"}
            />
          ))}
        </div>
      )}
    </div>
  )
}
