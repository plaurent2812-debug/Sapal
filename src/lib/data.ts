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
  specifications: Record<string, string>
  imageUrl: string
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
    specifications: p.specifications,
    imageUrl: p.image_url,
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
}

export function toClientCategory(c: Category): ClientCategory {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.image_url,
  }
}

// ---------- Fonctions de fetch ----------

export const getCategories = unstable_cache(
  async (): Promise<ClientCategory[]> => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name')

    if (error) throw error
    return (data ?? []).map(toClientCategory)
  },
  ['categories'],
  { revalidate: 3600, tags: ['categories'] }
)

export const getCategoryBySlug = unstable_cache(
  async (slug: string): Promise<ClientCategory | null> => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) return null
    return toClientCategory(data)
  },
  ['category-by-slug'],
  { revalidate: 3600, tags: ['categories'] }
)

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
