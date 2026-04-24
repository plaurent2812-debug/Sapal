import type { Metadata } from "next";
import Link from "next/link";
import {
  getCategoryBySlug,
  getCategoryChildren,
  getCategoryThumbnails,
  getCategoryProductCount,
  getProductsInCategoryTree,
} from "@/lib/data";
import { Button } from "@/components/ui/button";
import { AnimatedSection } from "@/components/ui/motion";
import { ArrowLeft } from "lucide-react";
import { ProductCard } from "@/components/catalogue/product-card"
import { CategoryPageClient } from '@/components/catalogue/category-page-client';
import { SubcategoriesManager } from '@/components/catalogue/subcategories-manager';
import { BreadcrumbStructuredData } from '@/components/seo/structured-data';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return { title: "Catégorie introuvable" };
  }

  return {
    title: category.name,
    description:
      category.description ||
      `Découvrez notre gamme ${category.name} chez SAPAL Signalisation. Devis gratuit.`,
    alternates: { canonical: `/catalogue/${slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return (
      <div className="container py-24 px-4 text-center mx-auto">
        <h1 className="font-heading text-3xl mb-4">Catégorie introuvable</h1>
        <Link href="/catalogue">
          <Button variant="outline">Retour au catalogue</Button>
        </Link>
      </div>
    );
  }

  // Si la catégorie a des enfants, on affiche d'abord les sous-catégories (mode navigation).
  // Sinon on affiche directement les produits (feuille de la taxonomie).
  const children = await getCategoryChildren(category.id);
  const hasChildren = children.length > 0;
  const products = hasChildren ? [] : await getProductsInCategoryTree(category.id);
  const childThumbs = hasChildren
    ? await getCategoryThumbnails(children.map((c) => c.id))
    : {};

  // Total : 1 appel RPC count au lieu de charger tous les produits
  const totalProducts = hasChildren
    ? await getCategoryProductCount(category.id)
    : products.length;

  return (
    <CategoryPageClient initialCategory={category}>
    <BreadcrumbStructuredData
      items={[
        { name: "Accueil", url: "/" },
        { name: "Catalogue", url: "/catalogue" },
        { name: category.name, url: `/catalogue/${slug}` },
      ]}
    />
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Hero */}
      <section className="relative w-full py-10 md:py-14 lg:py-20 bg-secondary/20 border-b border-border/50">
        <div className="container px-4 md:px-6 mx-auto">
          <Link
            href="/catalogue"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 md:mb-6 transition-colors group"
          >
            <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Retour au catalogue
          </Link>
          <AnimatedSection direction="up">
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight text-foreground">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-base md:text-lg text-muted-foreground mt-3 max-w-2xl">{category.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-3 md:mt-4">
              {hasChildren
                ? `${children.length} sous-catégorie${children.length > 1 ? 's' : ''} · ${totalProducts} produit${totalProducts > 1 ? 's' : ''}`
                : `${products.length} produit${products.length > 1 ? 's' : ''}`}
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Sous-catégories (si présentes) */}
      {hasChildren && (
        <section className="container px-4 md:px-6 mx-auto mt-8 md:mt-10">
          <SubcategoriesManager
            parentId={category.id}
            parentSlug={category.slug}
            basePath="/catalogue"
            children={children}
            thumbnails={childThumbs}
          />
        </section>
      )}

      {/* Produits (si feuille de la taxonomie) */}
      {!hasChildren && (
        <section className="container px-4 md:px-6 mx-auto mt-8 md:mt-10">
          {products.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">Aucun produit disponible dans cette catégorie.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  categorySlug={slug}
                  index={index}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
    </CategoryPageClient>
  );
}
