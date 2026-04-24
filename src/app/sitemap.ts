import type { MetadataRoute } from "next"
import { createBrowserClient } from "@/lib/supabase/client"
import { getCategories, getAllProducts } from "@/lib/data"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.sapal.fr"

type CategoryRow = {
  id: string
  slug: string
  parent_id: string | null
  level: number | null
  created_at?: string | null
}

type ProductRow = {
  id: string
  slug: string
  category_id: string
  supplier: string | null
  created_at?: string | null
}

function toDate(value?: string | null): Date | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return isNaN(d.getTime()) ? undefined : d
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createBrowserClient()

  // PostgREST plafonne à 1000 lignes par requête. On pagine pour tout récupérer.
  async function fetchAllProducts(): Promise<ProductRow[]> {
    const PAGE = 1000
    const all: ProductRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data } = await supabase
        .from("products")
        .select("id, slug, category_id, supplier, created_at")
        .range(from, from + PAGE - 1)
      const batch = (data ?? []) as ProductRow[]
      all.push(...batch)
      if (batch.length < PAGE) break
    }
    return all
  }

  // Tout récupérer en parallèle
  const [allCatsRes, allProducts, rootCategories, featuredProducts] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, slug, parent_id, level, created_at"),
      fetchAllProducts(),
      getCategories(),
      getAllProducts(),
    ])

  const allCategories = (allCatsRes.data ?? []) as CategoryRow[]

  const categoryById = new Map(allCategories.map((c) => [c.id, c]))
  const rootCategorySlugById = new Map(rootCategories.map((c) => [c.id, c.slug]))

  // Cherche l'ancêtre level=1 (univers) pour une catégorie Procity donnée
  function universeSlugForCategory(catId: string): string | undefined {
    let current: CategoryRow | undefined = categoryById.get(catId)
    while (current?.parent_id) {
      const parent = categoryById.get(current.parent_id)
      if (!parent) break
      current = parent
    }
    return current ? current.slug : undefined
  }

  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/catalogue`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/catalogue/fournisseurs/procity`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/devis`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/qui-sommes-nous`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/realisations`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/cgv`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]

  // Catégories SAPAL (racines + enfants sous un univers SAPAL)
  const categorySapalPages: MetadataRoute.Sitemap = rootCategories.map((cat) => ({
    url: `${SITE_URL}/catalogue/${cat.slug}`,
    lastModified: toDate(categoryById.get(cat.id)?.created_at) ?? now,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  // Catégories Procity (niveaux 2 et 3 sous /catalogue/fournisseurs/procity/[slug])
  // On inclut les catégories qui contiennent au moins un produit supplier='procity'
  // dans leur sous-arbre.
  const procityCategoryIds = new Set<string>()
  for (const product of allProducts) {
    if (product.supplier !== "procity") continue
    let current = categoryById.get(product.category_id)
    while (current) {
      procityCategoryIds.add(current.id)
      if (!current.parent_id) break
      current = categoryById.get(current.parent_id)
    }
  }

  const categoryProcityPages: MetadataRoute.Sitemap = allCategories
    .filter((c) => procityCategoryIds.has(c.id) && c.level === 2)
    .map((c) => ({
      url: `${SITE_URL}/catalogue/fournisseurs/procity/${c.slug}`,
      lastModified: toDate(c.created_at) ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }))

  // Produits SAPAL (catalogue général) : /catalogue/<root>/<product>
  const productSapalPages: MetadataRoute.Sitemap = featuredProducts
    .map((p) => {
      const catSlug = rootCategorySlugById.get(p.categoryId)
      if (!catSlug) return null
      const row = allProducts.find((r) => r.id === p.id)
      return {
        url: `${SITE_URL}/catalogue/${catSlug}/${p.slug}`,
        lastModified: toDate(row?.created_at) ?? now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }
    })
    .filter(Boolean) as MetadataRoute.Sitemap

  // Produits Procity : /catalogue/fournisseurs/procity/<cat-slug>/<product>
  const productProcityPages: MetadataRoute.Sitemap = allProducts
    .filter((p) => p.supplier === "procity")
    .map((p) => {
      const cat = categoryById.get(p.category_id)
      if (!cat) return null
      const universeSlug = universeSlugForCategory(p.category_id)
      if (!universeSlug) return null
      // On utilise le slug de la catégorie feuille (level 2 ou 3) comme segment après /procity
      // L'enfant level=2 a priorité — sinon on remonte.
      let targetSlug = cat.slug
      if ((cat.level ?? 1) > 2 && cat.parent_id) {
        const parent = categoryById.get(cat.parent_id)
        if (parent) targetSlug = parent.slug
      }
      return {
        url: `${SITE_URL}/catalogue/fournisseurs/procity/${targetSlug}/${p.slug}`,
        lastModified: toDate(p.created_at) ?? now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }
    })
    .filter(Boolean) as MetadataRoute.Sitemap

  return [
    ...staticPages,
    ...categorySapalPages,
    ...categoryProcityPages,
    ...productSapalPages,
    ...productProcityPages,
  ]
}
