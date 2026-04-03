"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuoteStore } from "@/store/useQuoteStore";
import { Button } from "@/components/ui/button";
import { Check, ShoppingCart } from "lucide-react";
import type { ClientProduct } from "@/lib/data";

export function ProductCard({ product, categorySlug, index = 0 }: { product: ClientProduct; categorySlug: string; index?: number }) {
  const addItem = useQuoteStore((state) => state.addItem);
  const [isAdded, setIsAdded] = useState(false);

  const specifications = Object.entries(product.specifications).slice(0, 2);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
      <Link
        href={`/catalogue/${categorySlug}/${product.slug}`}
        className="flex flex-col overflow-hidden bg-white border border-border/60 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-1.5 transition-all duration-300 group relative rounded-xl focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {/* Badge Réf */}
        {product.reference && (
          <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur text-xs font-mono font-medium px-2.5 py-1 rounded-md text-muted-foreground border border-border/50 shadow-sm">
            Réf. {product.reference}
          </div>
        )}

        {/* Image Container */}
        <div className="aspect-square w-full overflow-hidden flex items-center justify-center p-6 bg-gradient-to-br from-secondary/20 to-secondary/5 border-b border-border/30 relative">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-contain p-6 group-hover:scale-105 transition-transform duration-500 ease-out"
            />
          ) : (
            <div className="text-muted-foreground/40 font-medium text-xs border border-dashed border-border/80 px-4 py-2 bg-secondary/20 rounded-lg">
              Image absente
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-heading text-lg text-foreground group-hover:text-accent transition-colors leading-snug mb-1.5">
            {product.name}
          </h3>

          <p className="text-muted-foreground text-xs mb-3 flex-1 line-clamp-2">
            {product.description}
          </p>

          {specifications.length > 0 && (
            <div className="mb-4 space-y-1.5 bg-secondary/20 p-3 rounded-lg text-[11px] font-medium text-muted-foreground">
              {specifications.map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <span>{key}:</span>
                  <span className="text-foreground text-right truncate max-w-[70%]">{value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col mt-auto pt-2">
            {product.price > 0 ? (
              <div className="flex justify-between items-end mb-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Prix unit.</span>
                <span className="text-xl font-extrabold text-foreground">
                  {product.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € <span className="text-xs font-normal text-muted-foreground">HT</span>
                </span>
              </div>
            ) : (
              <div className="h-10 mb-2"></div>
            )}

            <Button
              onClick={handleAddToCart}
              variant={isAdded ? "secondary" : "default"}
              className={`w-full font-bold text-[13px] rounded-lg transition-all duration-300 ${isAdded ? 'bg-green-600/10 text-green-700 hover:bg-green-600/10 cursor-default' : 'btn-fill bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm hover:shadow-md hover:shadow-accent/10'}`}
              disabled={isAdded}
            >
              {isAdded ? (
                <>
                  <Check size={16} className="mr-2" /> Ajouté au devis
                </>
              ) : (
                <>
                  <ShoppingCart size={16} className="mr-2" /> Ajouter au devis
                </>
              )}
            </Button>
          </div>
        </div>
      </Link>
  );
}
