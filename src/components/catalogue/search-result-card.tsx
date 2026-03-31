"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuoteStore } from "@/store/useQuoteStore";
import { Button } from "@/components/ui/button";
import { Check, Plus } from "lucide-react";
import type { ClientProduct } from "@/lib/data";

export function SearchResultCard({ product, categorySlug }: { product: ClientProduct; categorySlug: string }) {
  const addItem = useQuoteStore((state) => state.addItem);
  const [isAdded, setIsAdded] = useState(false);

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
      className="flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-md hover:border-border/80 group"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted relative">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground/40 text-sm">
            Photo non disponible
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold group-hover:text-primary transition-colors mb-1 line-clamp-2">{product.name}</h3>
        {product.reference && (
          <p className="text-xs text-muted-foreground mb-2">Réf. {product.reference}</p>
        )}
        {product.price > 0 && (
          <p className="font-bold text-primary mb-3">
            {product.price.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € <span className="text-xs font-normal text-muted-foreground">HT</span>
          </p>
        )}
        <Button
          onClick={handleAddToCart}
          size="sm"
          variant={isAdded ? "secondary" : "default"}
          className={`w-full mt-auto font-semibold transition-all duration-300 ${isAdded ? "bg-green-100/50 text-green-700 hover:bg-green-100/50 cursor-default" : "cursor-pointer"}`}
          disabled={isAdded}
        >
          {isAdded ? (
            <><Check size={16} className="mr-1.5" /> Ajouté</>
          ) : (
            <><Plus size={16} className="mr-1.5" /> Devis</>
          )}
        </Button>
      </div>
    </Link>
  );
}
