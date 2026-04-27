"use client";

import { useState } from "react";
import { useQuoteStore } from "@/store/useQuoteStore";
import { Button } from "@/components/ui/button";
import { Check, Minus, Plus, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import type { ClientProduct, ClientVariant, ProductOption } from "@/lib/data";

interface Props {
  product: ClientProduct
  selectedVariant?: ClientVariant | null
  hasVariants?: boolean
  categorySlug?: string
  options?: ProductOption[]
}

const KIT_NIVEAU_ZERO_REGEX = /kit\s*(de\s*scellement\s*)?niveau\s*z(é|e)ro|niveau\s*0/i

export function AddToQuoteSection({ product, selectedVariant, hasVariants, categorySlug, options = [] }: Props) {
  const addItem = useQuoteStore((state) => state.addItem);
  const items = useQuoteStore((state) => state.items);
  const [isAdded, setIsAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showKitDialog, setShowKitDialog] = useState(false);
  const [selectedKits, setSelectedKits] = useState<Set<string>>(new Set());

  const isDisabled = (hasVariants ?? false) && !selectedVariant;
  const isInCart = items.some(
    (item) => item.product.id === product.id && item.variantId === selectedVariant?.id
  );

  const kitOptions = options.filter(o => KIT_NIVEAU_ZERO_REGEX.test(o.product.name))

  const performAdd = (kitsToAdd: ProductOption[] = []) => {
    addItem(product, quantity, selectedVariant?.id, selectedVariant?.label, selectedVariant?.delai, selectedVariant?.price, categorySlug, selectedVariant?.reference);
    for (const kit of kitsToAdd) {
      const v = kit.variants[0]
      addItem(kit.product, quantity, v?.id, v?.label, v?.delai, v?.price, categorySlug, v?.reference)
    }
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 3000);
  }

  const handleAdd = () => {
    if (kitOptions.length > 0) {
      // Pré-cocher tous les kits par défaut (encourage l'ajout)
      setSelectedKits(new Set(kitOptions.map(k => k.product.id)))
      setShowKitDialog(true)
      return
    }
    performAdd()
  };

  const confirmDialog = () => {
    const kitsToAdd = kitOptions.filter(k => selectedKits.has(k.product.id))
    performAdd(kitsToAdd)
    setShowKitDialog(false)
  }

  const skipDialog = () => {
    performAdd()
    setShowKitDialog(false)
  }

  return (
    <div className="space-y-4 mt-auto">
      {/* Sélecteur de quantité */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-muted-foreground">Quantité :</span>
        <div className="flex items-center gap-0 bg-secondary/30 rounded-xl ring-1 ring-border/50">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-10 h-10 rounded-l-xl flex items-center justify-center text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40"
            disabled={quantity <= 1}
          >
            <Minus size={16} />
          </button>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 h-10 text-center font-bold bg-transparent border-x border-border/50 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="w-10 h-10 rounded-r-xl flex items-center justify-center text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Bouton ajout */}
      <Button
        onClick={handleAdd}
        size="lg"
        variant={isAdded ? "secondary" : "default"}
        className={`btn-fill w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 ${
          isDisabled
            ? "opacity-50 cursor-not-allowed bg-secondary text-muted-foreground hover:bg-secondary"
            : isAdded
            ? "bg-green-100/50 text-green-700 hover:bg-green-100/50 cursor-default"
            : "bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
        }`}
        disabled={isAdded || isDisabled}
      >
        {isDisabled ? (
          <>
            <ShoppingCart size={22} className="mr-2" /> Sélectionnez une déclinaison
          </>
        ) : isAdded ? (
          <>
            <Check size={22} className="mr-2" /> Ajouté au devis
          </>
        ) : (
          <>
            <ShoppingCart size={22} className="mr-2" /> Ajouter au devis
          </>
        )}
      </Button>

      {/* Lien vers le devis */}
      {isInCart && !isAdded && (
        <Link href="/devis" className="block">
          <Button
            variant="outline"
            size="lg"
            className="w-full h-12 rounded-xl font-semibold cursor-pointer hover:border-accent/50 transition-colors"
          >
            <ShoppingCart size={18} className="mr-2" /> Voir mon devis ({items.length} article{items.length > 1 ? 's' : ''})
          </Button>
        </Link>
      )}

      {/* Pop-up : options "kit niveau zéro" disponibles */}
      {showKitDialog && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={skipDialog} aria-hidden="true" />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92%] max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-heading text-lg font-bold pr-4">Options de fixation disponibles</h3>
              <button onClick={skipDialog} className="p-1 rounded-lg hover:bg-secondary/60 transition-colors -mt-1 -mr-1" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Ce produit est livré avec poteaux à sceller dans le sol. Si votre site dispose d&apos;une dalle béton ou d&apos;un sol enrobé, vous aurez besoin du <strong>kit niveau zéro</strong> (platines de fixation).
            </p>

            <div className="space-y-2 mb-5">
              {kitOptions.map(kit => {
                const v = kit.variants[0]
                const price = v?.price ?? kit.product.price
                const checked = selectedKits.has(kit.product.id)
                return (
                  <label
                    key={kit.product.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      checked ? 'border-accent bg-accent/5' : 'border-border hover:border-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(selectedKits)
                        if (e.target.checked) next.add(kit.product.id); else next.delete(kit.product.id)
                        setSelectedKits(next)
                      }}
                      className="mt-0.5 w-4 h-4 accent-accent flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-snug">{kit.product.name}</p>
                      {kit.product.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{kit.product.description}</p>
                      )}
                    </div>
                    <p className="text-sm font-bold whitespace-nowrap">
                      +{price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </p>
                  </label>
                )
              })}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={skipDialog} className="flex-1 h-11 rounded-xl font-semibold cursor-pointer">
                Sans option
              </Button>
              <Button onClick={confirmDialog} className="flex-1 h-11 rounded-xl font-semibold bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer">
                Ajouter au devis
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
