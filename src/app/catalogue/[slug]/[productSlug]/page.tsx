import type { Metadata } from "next";
import Link from "next/link";
import { getCategoryBySlug, getProductBySlug, getProductsByCategory, getVariantsByProduct, getOptionsByProduct } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { AnimatedSection, AnimatedItem } from "@/components/ui/motion";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ProductPageClient } from "@/components/catalogue/product-page-client";
import { ProductCard } from "@/components/catalogue/product-card";
import { BreadcrumbStructuredData } from "@/components/seo/structured-data";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const [category, product] = await Promise.all([
    getCategoryBySlug(slug),
    getProductBySlug(productSlug),
  ]);

  if (!product || !category) {
    return { title: "Produit introuvable" };
  }

  const title = `${product.name} — ${category.name}`;
  const description =
    product.description.length > 155
      ? product.description.slice(0, 152) + "..."
      : product.description;

  return {
    title,
    description: description || `${product.name} disponible chez SAPAL Signalisation. Devis gratuit pour les collectivités.`,
    alternates: { canonical: `/catalogue/${slug}/${productSlug}` },
    openGraph: {
      title,
      description,
      type: "website",
      ...(product.imageUrl
        ? { images: [{ url: product.imageUrl, width: 1200, height: 630, alt: product.name }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(product.imageUrl ? { images: [product.imageUrl] } : {}),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  const [category, product] = await Promise.all([
    getCategoryBySlug(slug),
    getProductBySlug(productSlug),
  ]);

  if (!category || !product) {
    return (
      <div className="container py-24 px-4 text-center mx-auto">
        <h1 className="font-heading text-3xl mb-4">Produit introuvable</h1>
        <Link href={`/catalogue/${slug}`}>
          <Button variant="outline">Retour à la catégorie</Button>
        </Link>
      </div>
    );
  }

  const [variants, options, allCategoryProducts] = await Promise.all([
    getVariantsByProduct(product.id),
    getOptionsByProduct(product.id),
    getProductsByCategory(product.categoryId),
  ]);
  const relatedProducts = allCategoryProducts.filter(p => p.id !== product.id).slice(0, 4);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.reference || undefined,
    category: category.name,
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    ...(product.price > 0
      ? {
          offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
    brand: {
      "@type": "Organization",
      name: "SAPAL Signalisation",
    },
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <BreadcrumbStructuredData
        items={[
          { name: "Accueil", url: "/" },
          { name: "Catalogue", url: "/catalogue" },
          { name: category.name, url: `/catalogue/${slug}` },
          { name: product.name, url: `/catalogue/${slug}/${productSlug}` },
        ]}
      />
      {/* Breadcrumb */}
      <div className="border-b border-border/50 bg-secondary/10">
        <div className="container px-4 md:px-6 mx-auto py-3 md:py-4">
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-hide">
            <Link href="/catalogue" className="hover:text-foreground transition-colors">
              Catalogue
            </Link>
            <ChevronRight size={14} className="flex-shrink-0" />
            <Link href={`/catalogue/${slug}`} className="hover:text-foreground transition-colors">
              {category.name}
            </Link>
            <ChevronRight size={14} className="flex-shrink-0" />
            <span className="text-foreground font-medium truncate max-w-[150px] sm:max-w-[200px]">
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      <div className="container px-4 md:px-6 mx-auto py-6 md:py-8 lg:py-12">
        <Link
          href={`/catalogue/${slug}`}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 md:mb-8 transition-colors group"
        >
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Retour à {category.name}
        </Link>

        <AnimatedSection direction="up">
          <ProductPageClient
            product={product}
            variants={variants}
            options={options}
            category={category}
            categorySlug={slug}
          />
        </AnimatedSection>
      </div>

      {/* Produits similaires */}
      {relatedProducts.length > 0 && (
        <section className="w-full py-10 md:py-16 bg-secondary/10 border-t border-border/50">
          <div className="container px-4 md:px-6 mx-auto">
            <AnimatedSection direction="up">
              <h2 className="font-heading text-xl sm:text-2xl md:text-3xl tracking-tight mb-6 md:mb-8 accent-line">
                Produits similaires
              </h2>
            </AnimatedSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {relatedProducts.map((p, i) => (
                <AnimatedItem key={p.id} delay={i * 0.08}>
                  <ProductCard product={p} categorySlug={slug} />
                </AnimatedItem>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
