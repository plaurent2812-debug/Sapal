"use client";

import { useState } from "react";
import { useQuoteStore } from "@/store/useQuoteStore";
import { Button } from "@/components/ui/button";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import type { ClientProduct, ClientVariant } from "@/lib/data";

interface Props {
  product: ClientProduct
  selectedVariant?: ClientVariant | null
  hasVariants?: boolean
  categorySlug?: string
}

export function AddToQuoteSection({ product, selectedVariant, hasVariants, categorySlug }: Props) {
  const addItem = useQuoteStore((state) => state.addItem);
  const items = useQuoteStore((state) => state.items);
  const [isAdded, setIsAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const isDisabled = (hasVariants ?? false) && !selectedVariant;
  const isInCart = items.some(
    (item) => item.product.id === product.id && item.variantId === selectedVariant?.id
  );

  const handleAdd = () => {
    addItem(product, quantity, selectedVariant?.id, selectedVariant?.label, selectedVariant?.delai, selectedVariant?.price, categorySlug);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 3000);
  };

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
        className={`btn-fill w-full h-14 rounded-2xl font-bold text-lg transition-all duration-300 ${
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
    </div>
  );
}
