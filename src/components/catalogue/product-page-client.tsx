"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShieldCheck, Truck, Clock, Package, FileDown, Calendar, ChevronDown } from "lucide-react"
import type { ClientProduct, ClientVariant, ClientCategory, ProductOption } from "@/lib/data"
import { VariantSelector } from "./variant-selector"
import { AddToQuoteSection } from "./add-to-quote-section"
import { ProductOptionsSection } from "./product-options-section"
import { InlineEditOverlay } from "./inline-edit-overlay"
import { formatDelai } from "@/lib/utils"

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
  const [techOpen, setTechOpen] = useState(false)

  // Sync selectedVariant when variants are updated via inline edit
  useEffect(() => {
    if (selectedVariant) {
      const updated = currentVariants.find(v => v.id === selectedVariant.id)
      if (updated) setSelectedVariant(updated)
    }
  }, [currentVariants]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayReference = selectedVariant?.reference || currentProduct.reference
  const displayPrice = selectedVariant ? selectedVariant.price : currentProduct.price

  // Galerie : si la variante a ses propres images, on affiche UNIQUEMENT celles-là
  // (sinon on pollue la page avec toutes les déclinaisons). Sans variante, on
  // affiche la galerie produit complète (ou l'image principale en fallback).
  const galleryImages = useMemo(() => {
    const variantImages = selectedVariant?.images ?? []
    const variantPrimary = selectedVariant?.primaryImageUrl
    const variantAll = variantPrimary
      ? [variantPrimary, ...variantImages.filter(u => u !== variantPrimary)]
      : variantImages

    if (variantAll.length > 0) return variantAll

    const gallery = currentProduct.galleryImageUrls ?? []
    if (gallery.length > 0) return gallery

    return currentProduct.imageUrl ? [currentProduct.imageUrl] : []
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

    // Keys masquées :
    //  - "Type" : toujours égal à la catégorie (déjà affichée dans le breadcrumb)
    //  - "Finition" / "Crosse" : doublonnent "Structure" (matériau) sur les produits
    //    Procity ; une vraie finition distincte apparaîtra dans une autre clé.
    //  - "Dimensions" : redondant quand Longueur/Hauteur/Diamètre sont présents
    //    (on le garde uniquement si pas d'autre dimension chiffrée).
    const blacklistedKeys = new Set(['Type', 'Finition', 'Crosse'])
    const hasExplicitDimensions = Object.keys(specs).some(
      k => /Longueur|Hauteur|Diamètre|Largeur|Profondeur/i.test(k)
    )
    if (hasExplicitDimensions) blacklistedKeys.add('Dimensions')

    const seenValues = new Map<string, string>() // valeur normalisée → première clé

    return Object.entries(specs)
      .filter(([k, v]) => {
        if (!v || v === '-' || v === '') return false
        if (blacklistedKeys.has(k)) return false
        // Déduplication : si la même valeur existe déjà pour une autre clé, on skip
        const norm = v.trim().toLowerCase()
        const existingKey = seenValues.get(norm)
        if (existingKey && existingKey !== k) return false
        seenValues.set(norm, k)
        return true
      })
  }, [currentProduct.specifications, selectedVariant])

  // Scinde les specs en 2 blocs calqués sur Procity :
  //  - « Caractéristiques » : vue synthèse (matériau, âge, dimensions, surface,
  //    hauteur de chute, capacité).
  //  - « Caractéristiques techniques » : tout le reste (finition, éléments,
  //    montage, options, poids…).
  const { specsOverview, specsTechnical } = useMemo(() => {
    const isOverview = (key: string) => {
      const k = key
        .toLocaleLowerCase("fr")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
      return (
        k.includes("materiau structure") ||
        k === "materiau" ||
        k.includes("tranche d'age") ||
        k.includes("tranche d age") ||
        k.includes("dimension du jeu") ||
        k === "dimensions" ||
        k.includes("surface d'impact") ||
        k.includes("surface d impact") ||
        k.includes("hauteur de chute") ||
        k.includes("capacite d'accueil") ||
        k.includes("capacite d accueil")
      )
    }
    const overview: Array<[string, string]> = []
    const technical: Array<[string, string]> = []
    for (const entry of specifications) {
      if (isOverview(entry[0])) overview.push(entry)
      else technical.push(entry)
    }
    return { specsOverview: overview, specsTechnical: technical }
  }, [specifications])

  // Délai affiché : variante sélectionnée > majorité des variantes > fallback
  const displayDelai = useMemo(() => {
    if (selectedVariant?.delai) {
      const out = formatDelai(selectedVariant.delai)
      if (out) return out
    }

    // Pas de variante sélectionnée : on prend le délai le plus courant parmi les variantes
    if (currentVariants.length > 0) {
      const counts = new Map<string, number>()
      for (const v of currentVariants) {
        const out = formatDelai(v.delai)
        if (!out) continue
        counts.set(out, (counts.get(out) ?? 0) + 1)
      }
      if (counts.size > 0) {
        const [top] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
        return top[0]
      }
    }

    return 'Délai selon stock'
  }, [selectedVariant, currentVariants])


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

        {currentProduct.description?.trim() && (
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed whitespace-pre-line mb-5 sm:mb-6">
            {currentProduct.description}
          </p>
        )}

        {displayPrice > 0 && (
          <div className="mb-5 sm:mb-6 flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {displayPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </span>
            <span className="text-sm text-muted-foreground font-medium">HT / unité</span>
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

        {specsOverview.length > 0 && (
          <div className="mt-6 sm:mt-8">
            <h2 className="font-heading text-lg sm:text-xl mb-3 sm:mb-4">Caractéristiques</h2>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              {specsOverview.map(([key, value], i) => (
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

        {specsTechnical.length > 0 && (
          <div className="mt-6 sm:mt-8">
            <button
              type="button"
              onClick={() => setTechOpen((v) => !v)}
              aria-expanded={techOpen}
              aria-controls="specs-technical-list"
              className="w-full flex items-center justify-between gap-3 py-2 text-left group"
            >
              <h2 className="font-heading text-lg sm:text-xl">Caractéristiques techniques</h2>
              <ChevronDown
                size={20}
                className={`text-muted-foreground flex-shrink-0 transition-transform duration-200 group-hover:text-foreground ${
                  techOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {techOpen && (
              <div
                id="specs-technical-list"
                className="mt-3 sm:mt-4 rounded-xl border border-border/50 overflow-hidden"
              >
                {specsTechnical.map(([key, value], i) => (
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
            )}
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
