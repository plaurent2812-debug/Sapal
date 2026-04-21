"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShieldCheck, Truck, Clock, Package, FileDown, Calendar } from "lucide-react"
import type { ClientProduct, ClientVariant, ClientCategory, ProductOption } from "@/lib/data"
import { VariantSelector } from "./variant-selector"
import { AddToQuoteSection } from "./add-to-quote-section"
import { ProductOptionsSection } from "./product-options-section"
import { InlineEditOverlay } from "./inline-edit-overlay"

interface Props {
  product: ClientProduct
  variants: ClientVariant[]
  options: ProductOption[]
  category: ClientCategory
  categorySlug: string
}

export function ProductPageClient({ product, variants, options, category, categorySlug }: Props) {
  // Mutable state for inline editing
  const [currentProduct, setCurrentProduct] = useState(product)
  const [currentVariants, setCurrentVariants] = useState(variants)

  const [selectedVariant, setSelectedVariant] = useState<ClientVariant | null>(
    currentVariants.length === 1 ? currentVariants[0] : null
  )
  const [activeImageIdx, setActiveImageIdx] = useState(0)

  // Sync selectedVariant when variants are updated via inline edit
  useEffect(() => {
    if (selectedVariant) {
      const updated = currentVariants.find(v => v.id === selectedVariant.id)
      if (updated) setSelectedVariant(updated)
    }
  }, [currentVariants]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayReference = selectedVariant?.reference || currentProduct.reference
  const displayPrice = selectedVariant ? selectedVariant.price : currentProduct.price

  // Galerie : image variante (primary) en tête + galerie produit, dédupliquée.
  // Si pas de variante sélectionnée, on affiche la galerie produit complète
  // (ou l'image principale en fallback).
  const galleryImages = useMemo(() => {
    const gallery = currentProduct.galleryImageUrls ?? []
    const productGallery = gallery.length > 0
      ? gallery
      : (currentProduct.imageUrl ? [currentProduct.imageUrl] : [])

    if (selectedVariant?.primaryImageUrl) {
      const rest = productGallery.filter(u => u !== selectedVariant.primaryImageUrl)
      return [selectedVariant.primaryImageUrl, ...rest]
    }

    if (selectedVariant?.images && selectedVariant.images.length > 0) {
      return selectedVariant.images
    }

    return productGallery
  }, [selectedVariant, currentProduct.imageUrl, currentProduct.galleryImageUrls])

  // Quand on change de variante, revenir à l'image 0
  const handleVariantSelect = (v: ClientVariant) => {
    setSelectedVariant(v)
    setActiveImageIdx(0)
  }

  const currentImage = galleryImages[activeImageIdx] ?? null

  const specifications = useMemo(() => {
    const specs: Record<string, string> = { ...currentProduct.specifications }

    if (selectedVariant) {
      if (selectedVariant.dimensions) specs['Dimensions'] = selectedVariant.dimensions
      if (selectedVariant.poids) specs['Poids'] = selectedVariant.poids
      if (selectedVariant.finition) specs['Finition'] = selectedVariant.finition
      if (selectedVariant.specifications && Object.keys(selectedVariant.specifications).length > 0) {
        // Les attributs variantes ne surchargent PAS les caractéristiques produit,
        // ils les complètent (ex : "Structure autre" de variante, "Dimensions" de produit).
        for (const [k, v] of Object.entries(selectedVariant.specifications)) {
          if (!specs[k] && v) specs[k] = v
        }
      }
    }

    // Supprimer les entrées vides ou génériques
    return Object.entries(specs).filter(([, v]) => v && v !== '-' && v !== '')
  }, [currentProduct.specifications, selectedVariant])

  // Délai affiché : variante > produit > fallback
  const displayDelai = useMemo(() => {
    const raw = selectedVariant?.delai || ''
    if (!raw || raw === '-') return 'Délai selon stock'
    // Si c'est juste un nombre (semaines d'après Procity), on affiche "N semaines"
    if (/^\d+(\.\d+)?$/.test(raw)) {
      const n = Number(raw)
      return n >= 14 ? `${Math.ceil(n / 7)} semaines` : `${raw} jours`
    }
    return raw
  }, [selectedVariant])

  // Description affichée : SAPAL > raw > vide
  const displayDescription = currentProduct.descriptionSapal || currentProduct.description || ''

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-16">
      {/* ── Colonne image ── */}
      <div className="space-y-3">
        {/* Image principale */}
        <div className="aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-br from-secondary/30 to-secondary/5 border border-border/50 relative group">
          {currentImage ? (
            <Image
              key={currentImage}
              src={currentImage}
              alt={currentProduct.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-6 md:p-8 group-hover:scale-105 transition-transform duration-500"
              priority
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Package size={48} className="mx-auto mb-3 opacity-30" />
                <span className="text-sm">Photo non disponible</span>
              </div>
            </div>
          )}
          {displayReference && (
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-white/90 backdrop-blur text-[11px] sm:text-xs font-mono font-medium px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-muted-foreground border border-border/50 shadow-sm">
              Réf. {displayReference}
            </div>
          )}
        </div>

        {/* Miniatures galerie */}
        {galleryImages.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {galleryImages.map((img, i) => (
              <button
                key={img}
                onClick={() => setActiveImageIdx(i)}
                aria-label={`${currentProduct.name} — vue ${i + 1}`}
                aria-pressed={i === activeImageIdx}
                className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 ${
                  i === activeImageIdx
                    ? "border-accent"
                    : "border-border/50 hover:border-accent/50"
                }`}
              >
                <Image
                  src={img}
                  alt={`${currentProduct.name} vue ${i + 1}`}
                  width={56}
                  height={56}
                  className="object-contain w-full h-full p-1"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Colonne infos ── */}
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
          {currentProduct.name}
        </h1>

        {displayPrice > 0 && (
          <div className="mb-5 sm:mb-6 flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {displayPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </span>
            <span className="text-sm text-muted-foreground font-medium">HT / unité</span>
          </div>
        )}

        {displayDescription && (
          <div className="mb-5 sm:mb-6 text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-line">
            {displayDescription}
          </div>
        )}

        {displayDelai && (
          <div className="mb-5 sm:mb-6 inline-flex items-center gap-2 text-sm">
            <Calendar size={16} className="text-accent flex-shrink-0" />
            <span className="text-muted-foreground">Disponibilité :</span>
            <span className="font-semibold text-foreground">{displayDelai}</span>
          </div>
        )}

        <VariantSelector
          variants={currentVariants}
          selectedVariant={selectedVariant}
          onSelect={handleVariantSelect}
          hasVariants={currentVariants.length > 0}
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
          product={currentProduct}
          selectedVariant={selectedVariant}
          hasVariants={currentVariants.length > 0}
          categorySlug={categorySlug}
        />

        {currentProduct.techSheetUrl && (
          <div className="mt-4">
            <a
              href={currentProduct.techSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-border/50 rounded-lg text-sm font-medium text-foreground hover:bg-secondary/20 transition-colors"
            >
              <FileDown size={16} className="text-accent" />
              Télécharger la fiche technique
            </a>
          </div>
        )}

        <ProductOptionsSection options={options} />

        <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-border/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Truck size={18} className="text-accent" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Livraison France</p>
                <p className="text-xs text-muted-foreground">{displayDelai}</p>
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

        {currentProduct.supplier === 'procity' && (
          <div className="mt-5 text-xs text-muted-foreground italic">
            Produit fabriqué par Procity
          </div>
        )}
      </div>
    </div>

    {/* Inline Edit Overlay — only visible to admins */}
    <InlineEditOverlay
      product={currentProduct}
      variants={currentVariants}
      onProductSaved={setCurrentProduct}
      onVariantsSaved={setCurrentVariants}
    />
    </>
  )
}
