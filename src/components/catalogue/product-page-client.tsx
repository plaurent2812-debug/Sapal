"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ShieldCheck, Truck, Clock, Package } from "lucide-react"
import type { ClientProduct, ClientVariant, ClientCategory, ProductOption } from "@/lib/data"
import { VariantSelector } from "./variant-selector"
import { AddToQuoteSection } from "./add-to-quote-section"
import { ProductOptionsSection } from "./product-options-section"

interface Props {
  product: ClientProduct
  variants: ClientVariant[]
  options: ProductOption[]
  category: ClientCategory
  categorySlug: string
}

export function ProductPageClient({ product, variants, options, category, categorySlug }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<ClientVariant | null>(
    variants.length === 1 ? variants[0] : null
  )

  const displayReference = selectedVariant?.reference || product.reference
  const displayPrice = selectedVariant ? selectedVariant.price : product.price

  const specifications = useMemo(() => {
    const specs = { ...product.specifications }

    if (selectedVariant) {
      if (selectedVariant.dimensions) specs['Dimensions'] = selectedVariant.dimensions
      if (selectedVariant.poids) specs['Poids'] = selectedVariant.poids
      if (selectedVariant.finition) specs['Finition'] = selectedVariant.finition
      if (selectedVariant.delai) specs['Délai'] = /^\d+(\.\d+)?$/.test(selectedVariant.delai) ? (Number(selectedVariant.delai) >= 14 ? `${Math.ceil(Number(selectedVariant.delai) / 7)} semaines` : `${selectedVariant.delai} jours`) : selectedVariant.delai
      // Fusionne les specs supplémentaires du variant (si renseignées)
      if (selectedVariant.specifications && Object.keys(selectedVariant.specifications).length > 0) {
        Object.assign(specs, selectedVariant.specifications)
      }
    }

    return Object.entries(specs)
  }, [product.specifications, selectedVariant])

  return (
    <div className="flex flex-col">
      <div className="mb-2">
        <Link
          href={`/catalogue/${categorySlug}`}
          className="text-xs font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors"
        >
          {category.name}
        </Link>
      </div>

      <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl tracking-tight mb-3 sm:mb-4">
        {product.name}
      </h1>

      {displayPrice > 0 && (
        <div className="mb-5 sm:mb-6 flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {displayPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </span>
          <span className="text-sm text-muted-foreground font-medium">HT / unité</span>
        </div>
      )}

      <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-6 sm:mb-8">
        {product.description}
      </p>

      <VariantSelector
        variants={variants}
        selectedVariant={selectedVariant}
        onSelect={setSelectedVariant}
        hasVariants={variants.length > 0}
      />

      {displayReference && (
        <p className="text-xs font-mono text-muted-foreground mb-6">
          Réf. {displayReference}
        </p>
      )}

      {specifications.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h2 className="font-heading text-lg sm:text-xl mb-3 sm:mb-4">Caractéristiques</h2>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            {specifications.map(([key, value], i) => (
              <div
                key={key}
                className={`flex justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5 text-sm ${
                  i % 2 === 0 ? "bg-muted/20" : "bg-background"
                }`}
              >
                <span className="text-muted-foreground font-medium flex-shrink-0">{key}</span>
                <span className="font-semibold text-right break-words min-w-0">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AddToQuoteSection
        product={product}
        selectedVariant={selectedVariant}
        hasVariants={variants.length > 0}
        categorySlug={categorySlug}
      />

      <ProductOptionsSection options={options} />

      <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-border/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Truck size={18} className="text-accent" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Livraison France</p>
              <p className="text-xs text-muted-foreground">Délai selon stock</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={18} className="text-accent" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Certifié NF/CE</p>
              <p className="text-xs text-muted-foreground">Normes en vigueur</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-accent" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Devis en 24h</p>
              <p className="text-xs text-muted-foreground">Gratuit et sans engagement</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Package size={18} className="text-accent" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Mandat administratif</p>
              <p className="text-xs text-muted-foreground">Paiement 30 jours</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
