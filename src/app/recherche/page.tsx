import type { Metadata } from "next";
import Link from "next/link";
import { searchProducts, getCategories, getAllCategoriesFlat } from "@/lib/data";
import type { SearchFilters } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Search, ArrowLeft } from "lucide-react";
import { SearchResultCard } from "@/components/catalogue/search-result-card";
import { SearchFilters as SearchFiltersBar } from "@/components/catalogue/search-filters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recherche",
  description:
    "Recherchez parmi plus de 300 références de mobilier urbain, signalétique et équipements d'espaces publics SAPAL.",
  robots: { index: false, follow: true },
};

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }>;
}) {
  const { q, category, minPrice, maxPrice, sort } = await searchParams;
  const query = q?.trim() || "";

  const filters: SearchFilters = {
    category: category || undefined,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    sort: (sort as SearchFilters["sort"]) || undefined,
  };

  const hasFilters = !!(category || minPrice || maxPrice || (sort && sort !== "name-asc"));

  const results = query || hasFilters ? await searchProducts(query, filters) : [];
  const [categories, allCategories] = await Promise.all([
    getCategories(),
    getAllCategoriesFlat(),
  ]);

  // Lookup id → URL path (intègre toutes les catégories, pas juste les racines,
  // et préfixe /fournisseurs/procity/ quand la catégorie vient de Procity)
  const categoryPathMap = new Map(
    allCategories.map((c) => {
      const path = c.id.startsWith('proc-')
        ? `fournisseurs/procity/${c.slug}`
        : c.slug
      return [c.id, path]
    })
  )

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Hero */}
      <section className="relative w-full py-8 md:py-12 lg:py-16 bg-secondary/20 border-b border-border/50">
        <div className="container px-4 md:px-6 mx-auto">
          <Link
            href="/catalogue"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 md:mb-6 transition-colors"
          >
            <ArrowLeft size={16} className="mr-2" /> Retour au catalogue
          </Link>
          <div className="flex items-start gap-3 mb-2">
            <Search size={24} className="text-muted-foreground mt-1 flex-shrink-0" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight break-words">
              {query ? `Résultats pour « ${query} »` : "Recherche"}
            </h1>
          </div>
          {(query || hasFilters) && (
            <p className="text-muted-foreground">
              {results.length} produit{results.length !== 1 ? "s" : ""} trouvé{results.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </section>

      <section className="container px-4 md:px-6 mx-auto mt-6 md:mt-8">
        {/* Filters bar — always visible when there's a query or active filters */}
        {(query || hasFilters) && (
          <SearchFiltersBar categories={categories} />
        )}

        {!query && !hasFilters ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search size={48} className="text-muted-foreground/30 mb-6" />
            <h2 className="text-xl font-semibold mb-2">Recherchez un produit</h2>
            <p className="text-muted-foreground max-w-md">
              Utilisez la barre de recherche dans le menu ou appuyez sur <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs border">⌘K</kbd> pour rechercher par nom, référence ou description.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search size={48} className="text-muted-foreground/30 mb-6" />
            <h2 className="text-xl font-semibold mb-2">Aucun résultat</h2>
            <p className="text-muted-foreground max-w-md mb-8">
              Aucun produit ne correspond à vos critères. Essayez avec d'autres mots-clés ou modifiez les filtres.
            </p>
            <Link href="/catalogue">
              <Button className="cursor-pointer">Parcourir le catalogue</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {results.map((product) => (
              <SearchResultCard
                key={product.id}
                product={product}
                categorySlug={categoryPathMap.get(product.categoryId) || "catalogue"}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
