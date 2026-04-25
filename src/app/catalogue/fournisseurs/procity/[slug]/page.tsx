import type { Metadata } from "next"
import Link from "next/link"
import { permanentRedirect } from "next/navigation"
import {
  getCategoryBySlugForSupplier,
  getCategoryChildrenBySupplier,
  getCategoryThumbnailsBySupplier,
  getCategoryProductCount,
  getProductsInCategoryTreeBySupplier,
} from "@/lib/data"
import { Button } from "@/components/ui/button"
import { AnimatedSection } from "@/components/ui/motion"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { ProductCard } from "@/components/catalogue/product-card"
import { CategoryPageClient } from "@/components/catalogue/category-page-client"
import { SubcategoriesManager } from "@/components/catalogue/subcategories-manager"
import { BreadcrumbStructuredData } from "@/components/seo/structured-data"

const SUPPLIER = "procity"
const BASE_PATH = "/catalogue/fournisseurs/procity"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlugForSupplier(slug, SUPPLIER)
  if (!category) return { title: "Catégorie introuvable" }
  return {
    title: `${category.name} — Catalogue Procity`,
    description:
      category.description ||
      `Découvrez la gamme ${category.name} du catalogue Procity chez SAPAL Signalisation.`,
    alternates: { canonical: `${BASE_PATH}/${slug}` },
  }
}

export default async function ProcityCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const category = await getCategoryBySlugForSupplier(slug, SUPPLIER)

  if (!category) {
    return (
      <div className="container py-24 px-4 text-center mx-auto">
        <h1 className="font-heading text-3xl mb-4">Catégorie introuvable</h1>
        <Link href={BASE_PATH}>
          <Button variant="outline">Retour au catalogue Procity</Button>
        </Link>
      </div>
    )
  }

  const children = await getCategoryChildrenBySupplier(category.id, SUPPLIER)

  // Si la catégorie a exactement un enfant Procity de même nom, on saute l'étape
  // intermédiaire (ex. /procity/equipements-sportifs redirige vers /procity/equipements-sportifs-procity).
  const normalize = (s: string) => s.trim().toLocaleLowerCase("fr")
  if (
    children.length === 1 &&
    children[0].slug !== slug &&
    normalize(children[0].name) === normalize(category.name)
  ) {
    permanentRedirect(`${BASE_PATH}/${children[0].slug}`)
  }

  // Cas plate : catégorie avec un unique enfant Procity (nom différent) qui est
  // lui-même une feuille (pas d'enfants Procity). On conserve l'URL de la
  // catégorie parent mais on affiche directement les produits de l'enfant,
  // comme s'il n'y avait qu'un seul niveau. Évite l'étape « cliquer sur l'unique
  // tuile » (ex: structures-multi-activites → jeux-multifonctions).
  let flattenedFromChild = false
  if (children.length === 1) {
    const grandChildren = await getCategoryChildrenBySupplier(
      children[0].id,
      SUPPLIER,
    )
    if (grandChildren.length === 0) {
      flattenedFromChild = true
    }
  }

  const hasChildren = children.length > 0 && !flattenedFromChild
  const productSourceId = flattenedFromChild ? children[0].id : category.id
  const products =
    hasChildren && !flattenedFromChild
      ? []
      : await getProductsInCategoryTreeBySupplier(productSourceId, SUPPLIER)
  const childThumbs = hasChildren
    ? await getCategoryThumbnailsBySupplier(children.map((c) => c.id), SUPPLIER)
    : {}

  const totalProducts = hasChildren
    ? await getCategoryProductCount(category.id, SUPPLIER)
    : products.length

  return (
    <CategoryPageClient initialCategory={category}>
    <BreadcrumbStructuredData
      items={[
        { name: "Accueil", url: "/" },
        { name: "Catalogue", url: "/catalogue" },
        { name: "Catalogue Procity", url: BASE_PATH },
        { name: category.name, url: `${BASE_PATH}/${slug}` },
      ]}
    />
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <section className="relative w-full py-10 md:py-14 lg:py-20 bg-secondary/20 border-b border-border/50">
        <div className="container px-4 md:px-6 mx-auto">
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-hide mb-4">
            <Link href="/catalogue" className="hover:text-foreground transition-colors">
              Catalogue
            </Link>
            <ChevronRight size={14} className="flex-shrink-0" />
            <Link href={BASE_PATH} className="hover:text-foreground transition-colors">
              Catalogue Procity
            </Link>
            <ChevronRight size={14} className="flex-shrink-0" />
            <span className="text-foreground font-medium truncate max-w-[150px] sm:max-w-[300px]">
              {category.name}
            </span>
          </nav>

          <Link
            href={BASE_PATH}
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 md:mb-6 transition-colors group"
          >
            <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Catalogue Procity
          </Link>

          <AnimatedSection direction="up">
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight text-foreground">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-base md:text-lg text-muted-foreground mt-3 max-w-2xl">
                {category.description}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-3 md:mt-4">
              {hasChildren
                ? `${children.length} sous-catégorie${children.length > 1 ? "s" : ""} · ${totalProducts} produit${totalProducts > 1 ? "s" : ""}`
                : `${products.length} produit${products.length > 1 ? "s" : ""}`}
            </p>
          </AnimatedSection>
        </div>
      </section>

      {hasChildren && (
        <section className="container px-4 md:px-6 mx-auto mt-8 md:mt-10">
          <SubcategoriesManager
            parentId={category.id}
            parentSlug={category.slug}
            basePath={BASE_PATH}
            categories={children}
            thumbnails={childThumbs}
          />
        </section>
      )}

      {!hasChildren && (
        <section className="container px-4 md:px-6 mx-auto mt-8 md:mt-10">
          {products.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">
              Aucun produit Procity dans cette catégorie.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  categorySlug={`fournisseurs/procity/${slug}`}
                  index={index}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
    </CategoryPageClient>
  )
}
