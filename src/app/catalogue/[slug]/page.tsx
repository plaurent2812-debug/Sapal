import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  getCategoryBySlug,
  getCategoryChildren,
  getCategoryThumbnails,
  getProductsInCategoryTree,
} from "@/lib/data";
import { Button } from "@/components/ui/button";
import { AnimatedSection, AnimatedItem } from "@/components/ui/motion";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/catalogue/product-card";

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

  const totalProducts = hasChildren
    ? (await getProductsInCategoryTree(category.id)).length
    : products.length;

  return (
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
          <h2 className="font-heading text-xl sm:text-2xl mb-6">Sous-catégories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {children.map((child, i) => (
              <AnimatedItem key={child.id} delay={i * 0.03}>
                <Link
                  href={`/catalogue/${child.slug}`}
                  className="group flex items-center bg-white border border-border/60 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 rounded-xl p-4 overflow-hidden hover:-translate-y-1"
                >
                  <div className="w-20 h-20 flex-shrink-0 bg-gradient-to-br from-secondary/40 to-secondary/10 rounded-lg flex items-center justify-center overflow-hidden mr-4 border border-border/30 relative">
                    {(child.imageUrl || childThumbs[child.id]) ? (
                      <Image
                        src={child.imageUrl || childThumbs[child.id]}
                        alt={child.name}
                        fill
                        sizes="80px"
                        className="object-contain p-1 group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded bg-border text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <h3 className="font-bold text-sm md:text-base leading-tight pr-2 group-hover:text-accent transition-colors">
                      {child.name}
                    </h3>
                    <ChevronRight
                      size={20}
                      className="text-accent flex-shrink-0 -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
                    />
                  </div>
                </Link>
              </AnimatedItem>
            ))}
          </div>
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
  );
}
