"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { ClientCategory } from "@/lib/data";

const SORT_OPTIONS = [
  { value: "name-asc", label: "Nom A-Z" },
  { value: "name-desc", label: "Nom Z-A" },
  { value: "price-asc", label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
] as const;

export function SearchFilters({ categories }: { categories: ClientCategory[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get("category") || "";
  const currentMinPrice = searchParams.get("minPrice") || "";
  const currentMaxPrice = searchParams.get("maxPrice") || "";
  const currentSort = searchParams.get("sort") || "name-asc";

  const activeFilterCount =
    (currentCategory ? 1 : 0) +
    (currentMinPrice ? 1 : 0) +
    (currentMaxPrice ? 1 : 0) +
    (currentSort !== "name-asc" ? 1 : 0);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.push(`/recherche?${params.toString()}`);
    },
    [router, searchParams]
  );

  const resetFilters = useCallback(() => {
    const q = searchParams.get("q") || "";
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    router.push(`/recherche?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-end lg:flex-wrap gap-3 rounded-lg border border-border bg-secondary/30 p-4 mb-6">
      {/* Category */}
      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 lg:min-w-[180px]">
        <label className="text-xs font-medium text-muted-foreground">
          Catégorie
        </label>
        <select
          value={currentCategory}
          onChange={(e) => updateParams({ category: e.target.value })}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Min price */}
      <div className="flex flex-col gap-1 lg:w-[130px]">
        <label className="text-xs font-medium text-muted-foreground">
          Prix min (€)
        </label>
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="0"
          value={currentMinPrice}
          onChange={(e) => updateParams({ minPrice: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Max price */}
      <div className="flex flex-col gap-1 lg:w-[130px]">
        <label className="text-xs font-medium text-muted-foreground">
          Prix max (€)
        </label>
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="--"
          value={currentMaxPrice}
          onChange={(e) => updateParams({ maxPrice: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Sort */}
      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 lg:min-w-[180px]">
        <label className="text-xs font-medium text-muted-foreground">
          Trier par
        </label>
        <select
          value={currentSort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Reset */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="text-muted-foreground hover:text-foreground self-start sm:self-end sm:col-span-2 lg:col-span-1 cursor-pointer"
        >
          <X size={14} className="mr-1.5" />
          Réinitialiser
          <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold h-5 w-5">
            {activeFilterCount}
          </span>
        </Button>
      )}
    </div>
  );
}
