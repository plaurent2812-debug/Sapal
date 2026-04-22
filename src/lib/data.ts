import { createBrowserClient } from '@/lib/supabase/client'
import { unstable_cache } from 'next/cache'
import type { Category, Product, ProductVariantRow, ProductOptionRow } from '@/lib/supabase/types'

export type { Category, Product }

export interface ClientVariant {
  id: string
  productId: string
  reference: string
  label: string
  dimensions: string
  finition: string
  coloris: string
  poids: string
  price: number
  delai: string
  specifications: Record<string, string>
  images: string[]
  primaryImageUrl: string | null
}

export function toClientVariant(v: ProductVariantRow): ClientVariant {
  return {
    id: v.id,
    productId: v.product_id,
    reference: v.reference,
    label: v.label,
    dimensions: v.dimensions,
    finition: v.finition,
    coloris: v.coloris,
    poids: v.poids,
    price: Number(v.price) || 0,
    delai: v.delai,
    specifications: v.specifications,
    images: v.images ?? [],
    primaryImageUrl: v.primary_image_url ?? null,
  }
}

export async function getVariantsByProduct(productId: string): Promise<ClientVariant[]> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('label')

  if (error) return []
  return (data ?? []).map(toClientVariant)
}

export interface ClientProduct {
  id: string
  categoryId: string
  categorySlug?: string
  name: string
  slug: string
  description: string
  descriptionSapal: string | null
  specifications: Record<string, string>
  imageUrl: string
  galleryImageUrls: string[]
  techSheetUrl: string | null
  procityUrl: string | null
  price: number
  reference: string
  supplier?: string
  procitySheet?: string
  procityFamily?: string
  procityType?: string
}

export function toClientProduct(p: Product, categorySlug?: string): ClientProduct {
  return {
    id: p.id,
    categoryId: p.category_id,
    categorySlug,
    name: p.name,
    slug: p.slug,
    description: p.description,
    descriptionSapal: p.description_sapal ?? null,
    specifications: p.specifications,
    imageUrl: p.image_url,
    galleryImageUrls: p.gallery_image_urls ?? [],
    techSheetUrl: p.tech_sheet_url ?? null,
    procityUrl: p.procity_url ?? null,
    price: Number(p.price) || 0,
    reference: p.reference || '',
    supplier: p.supplier ?? undefined,
    procitySheet: p.procity_sheet ?? undefined,
    procityFamily: p.procity_family ?? undefined,
    procityType: p.procity_type ?? undefined,
  }
}

export interface ClientCategory {
  id: string
  name: string
  slug: string
  description: string
  imageUrl: string
  parentId: string | null
  level: number
  universe: string | null
  sortOrder: number
}

export function toClientCategory(c: Category & { parent_id?: string | null; level?: number; universe?: string | null; sort_order?: number }): ClientCategory {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.image_url,
    parentId: c.parent_id ?? null,
    level: c.level ?? 1,
    universe: c.universe ?? null,
    sortOrder: c.sort_order ?? 0,
  }
}

// ---------- Fonctions de fetch ----------

/**
 * Retourne les 4 univers Procity (niveau 1 avec `universe` non null).
 * Les catégories SAPAL historiques sans univers (balisage, jalonnement, etc.) sont
 * volontairement masquées du catalogue public — elles restent en DB pour ne pas perdre
 * les produits legacy rattachés, mais n'apparaissent plus dans la navigation.
 */
export const getCategories = unstable_cache(
  async (): Promise<ClientCategory[]> => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .is('parent_id', null)
      .not('universe', 'is', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return (data ?? []).map(toClientCategory)
  },
  ['categories-roots-v3'],
  { revalidate: 3600, tags: ['categories'] }
)

export const getCategoryBySlug = unstable_cache(
  async (slug: string): Promise<ClientCategory | null> => {
    const supabase = createBrowserClient()
    // Plusieurs catégories peuvent partager le même slug (ex: `espaces-verts` existe
    // comme cat SAPAL legacy niveau 1 ET comme sous-cat Procity niveau 2).
    // On retourne celle qui contient le plus de produits dans son arbre (la plus
    // utile pour l'utilisateur final).
    const { data: candidates } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
    if (!candidates || candidates.length === 0) return null
    if (candidates.length === 1) return toClientCategory(candidates[0])

    let best = candidates[0]
    let bestCount = -1
    for (const cat of candidates) {
      const descendantIds = await getCategoryAndDescendantIds(supabase, cat.id)
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .in('category_id', descendantIds)
      const n = count || 0
      if (n > bestCount) {
        best = cat
        bestCount = n
      }
    }
    return toClientCategory(best)
  },
  ['category-by-slug-v3'],
  { revalidate: 3600, tags: ['categories'] }
)

/** Retourne les enfants directs d'une catégorie (triés par sort_order puis nom). */
export const getCategoryChildren = unstable_cache(
  async (parentId: string): Promise<ClientCategory[]> => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) return []
    return (data ?? []).map(toClientCategory)
  },
  ['category-children'],
  { revalidate: 3600, tags: ['categories'] }
)

/**
 * Pour chaque catégorie fournie, retourne l'URL d'une image représentative (image
 * d'un produit au hasard dans l'arbre). Les catégories sans image sont omises.
 * Lookup en 2 étapes : pour les non-feuilles, chercher récursivement dans descendants.
 */
export const getCategoryThumbnails = unstable_cache(
  async (categoryIds: string[]): Promise<Record<string, string>> => {
    if (categoryIds.length === 0) return {}
    const supabase = createBrowserClient()
    const result: Record<string, string> = {}

    // Étape 1 : récupérer tous les descendants (y compris eux-mêmes) de chaque catégorie
    const descendantsOf = new Map<string, string[]>()
    for (const id of categoryIds) descendantsOf.set(id, [id])

    // BFS : niveau par niveau jusqu'à ce qu'il n'y ait plus d'enfants
    let frontier = categoryIds.slice()
    const parentChain = new Map<string, string>() // child_id -> ancestor_root_id
    for (const id of categoryIds) parentChain.set(id, id)

    while (frontier.length > 0) {
      const { data } = await supabase
        .from('categories')
        .select('id, parent_id')
        .in('parent_id', frontier)
      const next: string[] = []
      for (const row of data ?? []) {
        const ancestor = parentChain.get(row.parent_id)
        if (!ancestor) continue
        parentChain.set(row.id, ancestor)
        descendantsOf.get(ancestor)!.push(row.id)
        next.push(row.id)
      }
      frontier = next
    }

    // Étape 2 : pour chaque catégorie, récupérer une image produit
    for (const [rootId, allIds] of descendantsOf) {
      const { data } = await supabase
        .from('products')
        .select('image_url')
        .in('category_id', allIds)
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .limit(1)
      const img = data?.[0]?.image_url
      if (img) result[rootId] = img
    }
    return result
  },
  ['category-thumbnails'],
  { revalidate: 3600, tags: ['categories', 'products'] }
)

/**
 * Retourne tous les IDs descendants d'une catégorie (y compris elle-même).
 * Utile pour afficher tous les produits d'un univers/catégorie agrégés.
 */
async function getCategoryAndDescendantIds(
  supabase: ReturnType<typeof createBrowserClient>,
  rootId: string,
): Promise<string[]> {
  const all: string[] = [rootId]
  let frontier = [rootId]
  while (frontier.length > 0) {
    const { data } = await supabase
      .from('categories')
      .select('id')
      .in('parent_id', frontier)
    const next = (data ?? []).map((r: { id: string }) => r.id)
    if (next.length === 0) break
    all.push(...next)
    frontier = next
  }
  return all
}

/** Produits dans une catégorie et toutes ses descendantes. */
export async function getProductsInCategoryTree(rootCategoryId: string): Promise<ClientProduct[]> {
  const supabase = createBrowserClient()
  const ids = await getCategoryAndDescendantIds(supabase, rootCategoryId)
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(slug)')
    .in('category_id', ids)
    .order('name')
  if (error) return []
  return (data ?? []).map((p: Product & { categories?: { slug: string } }) => toClientProduct(p, p.categories?.slug))
}

/* ========================================================================== */
/* Variantes filtrées par fournisseur (Catalogue Procity, Catalogue Vialux...) */
/* Ces helpers permettent d'afficher la même hiérarchie catégorielle que       */
/* "Tous nos produits" mais en ne montrant que les produits d'un fournisseur   */
/* donné et les catégories qui en contiennent.                                 */
/* ========================================================================== */

/**
 * Résout un slug de catégorie dans le contexte d'un fournisseur.
 *
 * Plusieurs catégories peuvent partager le même slug (ex: `espaces-verts` existe
 * à la fois comme catégorie SAPAL legacy niveau 1 et comme sous-cat Procity niveau 2).
 * Pour la navigation `/catalogue/fournisseurs/<supplier>/<slug>`, on cherche la
 * catégorie qui contient effectivement des produits du fournisseur dans son arbre.
 */
export async function getCategoryBySlugForSupplier(
  slug: string,
  supplier: string,
): Promise<ClientCategory | null> {
  const supabase = createBrowserClient()
  const { data: candidates } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .order('level', { ascending: false }) // commence par les plus profondes
  if (!candidates || candidates.length === 0) return null

  for (const cat of candidates) {
    const descendantIds = await getCategoryAndDescendantIds(supabase, cat.id)
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .in('category_id', descendantIds)
      .eq('supplier', supplier)
    if ((count || 0) > 0) return toClientCategory(cat)
  }
  return toClientCategory(candidates[0])
}

/**
 * Renvoie les catégories racine (niveau 1) contenant AU MOINS un produit du
 * fournisseur donné. Utilisé pour `/catalogue/fournisseurs/procity`.
 */
export async function getCategoriesBySupplier(supplier: string): Promise<ClientCategory[]> {
  const supabase = createBrowserClient()
  const { data: roots, error } = await supabase
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .not('universe', 'is', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) return []

  // Ne garder que les univers qui ont au moins 1 produit du supplier dans leur arbre
  const withProducts: ClientCategory[] = []
  for (const root of roots ?? []) {
    const descendantIds = await getCategoryAndDescendantIds(supabase, root.id)
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .in('category_id', descendantIds)
      .eq('supplier', supplier)
    if ((count || 0) > 0) withProducts.push(toClientCategory(root))
  }
  return withProducts
}

/** Enfants d'une catégorie qui contiennent au moins 1 produit du supplier. */
export async function getCategoryChildrenBySupplier(
  parentId: string,
  supplier: string,
): Promise<ClientCategory[]> {
  const supabase = createBrowserClient()
  const { data: children, error } = await supabase
    .from('categories')
    .select('*')
    .eq('parent_id', parentId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) return []

  const withProducts: ClientCategory[] = []
  for (const child of children ?? []) {
    const descendantIds = await getCategoryAndDescendantIds(supabase, child.id)
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .in('category_id', descendantIds)
      .eq('supplier', supplier)
    if ((count || 0) > 0) withProducts.push(toClientCategory(child))
  }
  return withProducts
}

/** Produits d'une catégorie (et descendants) filtrés par fournisseur. */
export async function getProductsInCategoryTreeBySupplier(
  rootCategoryId: string,
  supplier: string,
): Promise<ClientProduct[]> {
  const supabase = createBrowserClient()
  const ids = await getCategoryAndDescendantIds(supabase, rootCategoryId)
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(slug)')
    .in('category_id', ids)
    .eq('supplier', supplier)
    .order('name')
  if (error) return []
  return (data ?? []).map((p: Product & { categories?: { slug: string } }) =>
    toClientProduct(p, p.categories?.slug),
  )
}

/** Vignettes catégorie (image produit descendant) filtrées par fournisseur. */
export async function getCategoryThumbnailsBySupplier(
  categoryIds: string[],
  supplier: string,
): Promise<Record<string, string>> {
  if (categoryIds.length === 0) return {}
  const supabase = createBrowserClient()
  const result: Record<string, string> = {}
  for (const rootId of categoryIds) {
    const allIds = await getCategoryAndDescendantIds(supabase, rootId)
    const { data } = await supabase
      .from('products')
      .select('image_url')
      .in('category_id', allIds)
      .eq('supplier', supplier)
      .not('image_url', 'is', null)
      .neq('image_url', '')
      .limit(1)
    const img = data?.[0]?.image_url
    if (img) result[rootId] = img
  }
  return result
}

export const getProductsByCategory = unstable_cache(
  async (categoryId: string): Promise<ClientProduct[]> => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(slug)')
      .eq('category_id', categoryId)
      .order('name')

    if (error) throw error
    return (data ?? []).map((p: Product & { categories?: { slug: string } }) => toClientProduct(p, p.categories?.slug))
  },
  ['products-by-category'],
  { revalidate: 3600, tags: ['products'] }
)

export const getAllProducts = unstable_cache(
  async (): Promise<ClientProduct[]> => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(slug)')
      .order('name')

    if (error) throw error
    return (data ?? []).map((p: Product & { categories?: { slug: string } }) => toClientProduct(p, p.categories?.slug))
  },
  ['all-products'],
  { revalidate: 3600, tags: ['products'] }
)

export const getProductsCount = unstable_cache(
  async (): Promise<number> => {
    const supabase = createBrowserClient()
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    if (error) return 0
    return count || 0
  },
  ['products-count'],
  { revalidate: 3600, tags: ['products'] }
)


export const getFeaturedProducts = unstable_cache(
  async (limit: number = 4): Promise<ClientProduct[]> => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(slug)')
      .order('price', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []).map((p: Product & { categories?: { slug: string } }) => toClientProduct(p, p.categories?.slug))
  },
  ['featured-products'],
  { revalidate: 3600, tags: ['products'] }
)

export const getProductBySlug = unstable_cache(
  async (slug: string): Promise<ClientProduct | null> => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(slug)')
      .eq('slug', slug)
      .single()

    if (error) return null
    return toClientProduct(data, (data as Product & { categories?: { slug: string } }).categories?.slug)
  },
  ['product-by-slug'],
  { revalidate: 3600, tags: ['products'] }
)

export async function getRelatedProducts(categoryId: string, excludeId: string, limit: number = 4): Promise<ClientProduct[]> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(slug)')
    .eq('category_id', categoryId)
    .neq('id', excludeId)
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((p: Product & { categories?: { slug: string } }) => toClientProduct(p, p.categories?.slug))
}

export interface SearchFilters {
  category?: string
  minPrice?: number
  maxPrice?: number
  sort?: 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'
}

export async function searchProducts(query: string, filters?: SearchFilters): Promise<ClientProduct[]> {
  const supabase = createBrowserClient()

  let q = supabase
    .from('products')
    .select('*, categories(slug)')

  // Text search fuzzy (pg_trgm) — si pas de filtres, utiliser la RPC
  if (query && !filters?.category && !filters?.minPrice && !filters?.maxPrice) {
    const { data, error } = await supabase.rpc('search_products_fuzzy', {
      search_term: query,
      max_results: 50,
    })
    if (error) throw error
    let results = (data ?? []).map((p: Product) => toClientProduct(p))
    // Appliquer le tri côté client si demandé
    const sort = filters?.sort || 'name-asc'
    if (sort !== 'name-asc') {
      results = results.sort((a: ClientProduct, b: ClientProduct) => {
        switch (sort) {
          case 'name-desc': return b.name.localeCompare(a.name)
          case 'price-asc': return a.price - b.price
          case 'price-desc': return b.price - a.price
          default: return 0
        }
      })
    }
    return results
  }

  // Fallback : text search ILIKE (quand des filtres sont appliqués)
  if (query) {
    q = q.or(`name.ilike.%${query}%,description.ilike.%${query}%,reference.ilike.%${query}%`)
  }

  // Category filter
  if (filters?.category) {
    q = q.eq('category_id', filters.category)
  }

  // Price range filters
  if (filters?.minPrice !== undefined && filters.minPrice > 0) {
    q = q.gte('price', filters.minPrice)
  }
  if (filters?.maxPrice !== undefined && filters.maxPrice > 0) {
    q = q.lte('price', filters.maxPrice)
  }

  // Sorting
  const sort = filters?.sort || 'name-asc'
  switch (sort) {
    case 'name-desc':
      q = q.order('name', { ascending: false })
      break
    case 'price-asc':
      q = q.order('price', { ascending: true })
      break
    case 'price-desc':
      q = q.order('price', { ascending: false })
      break
    case 'name-asc':
    default:
      q = q.order('name', { ascending: true })
      break
  }

  q = q.limit(50)

  const { data, error } = await q

  if (error) throw error
  return (data ?? []).map((p: Product & { categories?: { slug: string } }) => toClientProduct(p, p.categories?.slug))
}

// ---------- Recherche fuzzy (autocomplete) ----------

export interface AutocompleteResult {
  id: string
  name: string
  slug: string
  reference: string
  price: number
  imageUrl: string
  categorySlug: string
}

export async function searchAutocomplete(query: string, limit: number = 6): Promise<AutocompleteResult[]> {
  if (!query || query.length < 2) return []
  const supabase = createBrowserClient()
  const { data, error } = await supabase.rpc('search_products_autocomplete', {
    search_term: query,
    max_results: limit,
  })
  if (error) return []
  return (data ?? []).map((r: { id: string; name: string; slug: string; reference: string; price: number; image_url: string; category_slug: string }) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    reference: r.reference,
    price: Number(r.price) || 0,
    imageUrl: r.image_url || '',
    categorySlug: r.category_slug,
  }))
}

// ---------- Options produit ----------

export interface ProductOption {
  product: ClientProduct
  variants: ClientVariant[]
}

export async function getOptionsByProduct(productId: string): Promise<ProductOption[]> {
  const supabase = createBrowserClient()

  const { data: links } = await supabase
    .from('product_options')
    .select('option_product_id')
    .eq('product_id', productId)

  if (!links || links.length === 0) return []

  const optionIds = links.map((l: { option_product_id: string }) => l.option_product_id)

  const { data: optionProducts } = await supabase
    .from('products')
    .select('*')
    .in('id', optionIds)
    .order('name')

  if (!optionProducts) return []

  const { data: optionVariants } = await supabase
    .from('product_variants')
    .select('*')
    .in('product_id', optionIds)
    .order('label')

  const variantsByProduct = new Map<string, ClientVariant[]>()
  for (const v of (optionVariants ?? [])) {
    const pid = (v as { product_id: string }).product_id
    if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, [])
    variantsByProduct.get(pid)!.push(toClientVariant(v))
  }

  return optionProducts.map((p: Product) => ({
    product: toClientProduct(p),
    variants: variantsByProduct.get(p.id) ?? [],
  }))
}

export const getProcityProducts = unstable_cache(
  async (): Promise<ClientProduct[]> => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(slug)')
      .eq('supplier', 'procity')
      .order('name')

    if (error) throw error
    return (data ?? []).map((p: Product & { categories?: { slug: string } }) =>
      toClientProduct(p, p.categories?.slug)
    )
  },
  ['procity-products'],
  { revalidate: 3600, tags: ['products'] }
)
