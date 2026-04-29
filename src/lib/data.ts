import { createBrowserClient } from '@/lib/supabase/client'
import { unstable_cache } from 'next/cache'
import type { Category, Product, ProductVariantRow, ProductOptionRow } from '@/lib/supabase/types'
import { escapePostgrestLikePattern } from '@/lib/security-utils'

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

  // Vérifier si le produit est composé (product_component_links) — ex vitrines
  // sur poteaux = vitrine + piètement. Si oui, on calcule les variantes combinées
  // à la volée au lieu de les matérialiser en base (éviterait des milliers de lignes).
  const { data: links } = await supabase
    .from('product_component_links')
    .select('component_product_id, component_role')
    .eq('product_id', productId)

  if (links && links.length > 0) {
    return buildComposedVariants(links as Array<{ component_product_id: string; component_role: string }>)
  }

  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('label')

  if (error) return []
  return (data ?? []).map(toClientVariant)
}

// Compose les variantes "sur poteaux" : pour chaque variante base (vitrine),
// on déduit la hauteur piètement selon la hauteur de la vitrine, puis on crée
// les N variantes composées (une par type de piètement, ± bandeau titre).
// La ref finale suit le format Procity : `vitrine+pietement[+bandeau].COULEUR`
async function buildComposedVariants(
  links: Array<{ component_product_id: string; component_role: string }>
): Promise<ClientVariant[]> {
  const supabase = createBrowserClient()

  const baseLink = links.find(l => l.component_role === 'base')
  const pietementLink = links.find(l => l.component_role === 'pietement')
  if (!baseLink || !pietementLink) return []

  // Bandeau-titre : on le cherche par convention. 407002 → 402910, 410002 → 402900
  const bandeauProductId = baseLink.component_product_id === '407002' ? '402910'
    : baseLink.component_product_id === '410002' ? '402900'
    : null

  const [baseResult, pietementResult, bandeauResult, composedImagesResult] = await Promise.all([
    supabase.from('product_variants').select('*').eq('product_id', baseLink.component_product_id).order('label'),
    supabase.from('product_variants').select('*').eq('product_id', pietementLink.component_product_id).order('label'),
    bandeauProductId
      ? supabase.from('product_variants').select('*').eq('product_id', bandeauProductId)
      : Promise.resolve({ data: [] }),
    supabase.from('composed_product_images').select('reference_composed, image_url'),
  ])
  const composedImages = new Map<string, string>(
    ((composedImagesResult.data as Array<{ reference_composed: string; image_url: string }>) ?? [])
      .map(r => [r.reference_composed, r.image_url])
  )
  const baseVariants = (baseResult.data ?? []).map(toClientVariant)
  const pietementVariants = (pietementResult.data ?? []).map(toClientVariant)
  const bandeauVariants = ((bandeauResult as { data: ProductVariantRow[] | null }).data ?? []).map(toClientVariant)
  if (baseVariants.length === 0 || pietementVariants.length === 0) return []

  // Regrouper les piètements par type (initial-scellement, initial-platines,
  // complementaire-scellement, complementaire-platine), par hauteur et finition
  type PKey = { type: string; hauteur: string; coloris: string }
  const pietByKey = (k: PKey): ClientVariant | null =>
    pietementVariants.find(p =>
      p.specifications?.PietementType === k.type &&
      p.dimensions === k.hauteur &&
      p.coloris === k.coloris
    ) ?? null

  const composed: ClientVariant[] = []

  for (const b of baseVariants) {
    // Déduire la hauteur piètement selon la hauteur vitrine (vitrine 1000 = H min, etc.)
    const hVitrine = parseInt((b.dimensions.match(/H\s*(\d+)/)?.[1] ?? '0'), 10)
    const heights = inferPoleHeights(hVitrine, pietementLink.component_product_id)
    const pColoris = b.coloris === 'Anodisé' ? 'Anodisé' : 'Couleurs vitrine'
    const bandeauColoris = pColoris
    const colorSuffix = colorCodeFromRal(b.coloris)

    // Récupérer largeur vitrine pour matcher bandeau
    const lgVitrine = parseInt((b.dimensions.match(/x\s*(\d+)/)?.[1] ?? '0'), 10)
    const bandeau = bandeauVariants.find(bd =>
      bd.coloris === bandeauColoris &&
      parseInt((bd.dimensions.match(/LG\s*(\d+)/)?.[1] ?? '0'), 10) === lgVitrine
    ) ?? null

    // Types de piètement possibles pour la famille
    const isO76 = pietementLink.component_product_id === '416410'
    const pietementTypes = isO76
      ? [{ key: 'initial-scellement', label: 'Poteaux initiaux scellement direct', fixation: 'scellement' }]
      : [
          { key: 'initial-scellement', label: 'Poteaux initiaux scellement direct', fixation: 'scellement' },
          { key: 'initial-platines',   label: 'Poteaux initiaux sur platines',     fixation: 'platines' },
          { key: 'complementaire-scellement', label: 'Poteau complémentaire scellement direct', fixation: 'scellement' },
          { key: 'complementaire-platine',    label: 'Poteau complémentaire sur platine',      fixation: 'platines' },
        ]

    for (const pt of pietementTypes) {
      const hauteur = pt.fixation === 'scellement' ? heights.scellement : heights.platines
      if (!hauteur) continue

      const piet = pietByKey({
        type: `${pt.key}-sans-bandeau`,
        hauteur,
        coloris: pColoris,
      })
      if (!piet) continue

      // Variante "sans bandeau titre"
      composed.push(makeComposed(b, piet, null, pt.label + ' - sans bandeau titre', colorSuffix, composedImages))

      // Variante "avec bandeau titre" (seulement pour types initial/complémentaire scellement, cf Procity)
      if (bandeau && (pt.key === 'initial-scellement' || pt.key === 'complementaire-scellement')) {
        composed.push(makeComposed(b, piet, bandeau, pt.label + ' - avec bandeau titre', colorSuffix, composedImages))
      }
    }
  }
  return composed
}

// Détermine hauteurs (scellement, platines) selon hauteur vitrine et famille
function inferPoleHeights(hVitrine: number, pietementProductId: string): { scellement: string | null; platines: string | null } {
  if (pietementProductId === '416410') {
    // Piètement Ø76 : 3 hauteurs H2475 / H2700 / H3000
    if (hVitrine <= 1000) return { scellement: 'H 2475 mm', platines: null }
    if (hVitrine <= 1050) return { scellement: 'H 2700 mm', platines: null }
    return { scellement: 'H 3000 mm', platines: null }
  }
  // Piètement Quatro
  if (hVitrine <= 1050) return { scellement: 'H 2475 mm', platines: 'H 2058 mm' }
  if (hVitrine === 1350) return { scellement: 'H 2700 mm', platines: 'H 2208 mm' }
  return { scellement: 'H 3000 mm', platines: 'H 2208 mm' }
}

// Code couleur Procity pour le suffixe de ref
function colorCodeFromRal(coloris: string): string {
  const c = coloris.toLowerCase()
  if (c.includes('anodis')) return 'ANOD'
  if (c.includes('gris procity')) return 'GPRO'
  const m = c.match(/(\d{4})/)
  return m ? m[1] : ''
}

function makeComposed(
  base: ClientVariant,
  pietement: ClientVariant,
  bandeau: ClientVariant | null,
  pietementLabel: string,
  colorSuffix: string,
  composedImages: Map<string, string>,
): ClientVariant {
  const refParts = [base.reference, pietement.reference]
  if (bandeau) refParts.push(bandeau.reference)
  const reference = refParts.join('+') + (colorSuffix ? '.' + colorSuffix : '')
  const price = (base.price || 0) + (pietement.price || 0) + (bandeau?.price || 0)
  const delai = mergeDelais(mergeDelais(base.delai, pietement.delai), bandeau?.delai ?? '')

  // Chercher une image composée dédiée (ex: 410070+416401_5010).
  // Recherche stricte : la couleur DOIT toujours matcher pour éviter
  // d'afficher une photo de mauvaise couleur.
  //   1) combo exact (base + piètement + couleur)
  //   2) même base + même couleur + n'importe quel piètement de la même famille
  //   3) même famille base (vitrine) + même couleur + n'importe quel piètement
  //   4) image de la variante base seule (fallback final, même couleur garantie)
  const lowerColor = colorSuffix.toLowerCase()
  const baseFamily = base.reference.slice(0, 3) // "407", "410", etc.
  const candidateKeys = [
    `${base.reference}+${pietement.reference}_${lowerColor}`,  // exact
    // Même vitrine (même ref base) + même couleur + n'importe quel piètement
    ...Array.from(composedImages.keys()).filter(k => k.startsWith(`${base.reference}+`) && k.endsWith(`_${lowerColor}`)),
    // Même famille de vitrine (407xxx / 410xxx / 414xxx / 412xxx) + même couleur
    ...Array.from(composedImages.keys()).filter(k => {
      const m = k.match(/^(\d{6})\+.+_(.+)$/)
      return m && m[1].startsWith(baseFamily) && m[2] === lowerColor
    }),
  ]
  const composedImage = candidateKeys
    .map(k => composedImages.get(k))
    .find(url => !!url) ?? null

  // Si pas de photo "sur poteaux" dans la bonne couleur, on utilise l'image
  // de la vitrine murale (qui est déjà de la bonne couleur grâce à l'import
  // par ref+color qu'on a fait pour Vitrine 1000/2000).
  const images = composedImage ? [composedImage] : base.images
  const primary = composedImage ?? base.primaryImageUrl

  return {
    id: `${base.id}__${pietement.id}${bandeau ? '__' + bandeau.id : ''}`,
    productId: base.productId,
    reference,
    label: `${base.label} + ${pietementLabel}`,
    dimensions: base.dimensions,
    finition: base.finition,
    coloris: base.coloris,
    poids: base.poids,
    price,
    delai,
    specifications: {
      ...base.specifications,
      'Piètement': pietementLabel,
      'Référence vitrine': base.reference,
      'Référence piètement': pietement.reference,
      ...(bandeau ? { 'Référence bandeau-titre': bandeau.reference } : {}),
    },
    images,
    primaryImageUrl: primary,
  }
}

// Prend deux délais (ex: "2 semaines", "En stock") et renvoie le plus long.
// "En stock" < N semaines.
function mergeDelais(a: string, b: string): string {
  const toWeeks = (s: string): number => {
    if (!s) return 0
    const m = s.match(/(\d+)\s*semaine/i)
    if (m) return parseInt(m[1], 10)
    if (/stock/i.test(s)) return 0
    return 0
  }
  return toWeeks(a) >= toWeeks(b) ? a : b
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
  delai: string
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
    delai: p.delai ?? '',
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

/** Toutes les catégories (toutes profondeurs), pour construire un lookup id → slug
 *  côté recherche / résultats. */
export const getAllCategoriesFlat = unstable_cache(
  async (): Promise<Array<{ id: string; slug: string }>> => {
    const supabase = createBrowserClient()
    const PAGE = 1000
    const all: Array<{ id: string; slug: string }> = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('categories')
        .select('id, slug')
        .range(from, from + PAGE - 1)
      if (error) return all
      const batch = (data ?? []) as typeof all
      all.push(...batch)
      if (batch.length < PAGE) break
    }
    return all
  },
  ['categories-flat-v1'],
  { revalidate: 3600, tags: ['categories'] }
)

export const getCategoryBySlug = unstable_cache(
  async (slug: string): Promise<ClientCategory | null> => {
    const supabase = createBrowserClient()
    // Plusieurs catégories peuvent partager le même slug (ex: `espaces-verts` existe
    // comme cat SAPAL legacy niveau 1 ET comme sous-cat Procity niveau 2).
    // On retourne celle qui contient le plus de produits (via 1 RPC au lieu de N).
    const { data: candidates } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
    if (!candidates || candidates.length === 0) return null
    if (candidates.length === 1) return toClientCategory(candidates[0])

    const ids = (candidates as Array<{ id: string }>).map((c) => c.id)
    const counts = await fetchProductCounts(supabase, ids, null)
    let best = candidates[0]
    let bestCount = counts.get(candidates[0].id) || 0
    for (const cat of candidates) {
      const n = counts.get(cat.id) || 0
      if (n > bestCount) {
        best = cat
        bestCount = n
      }
    }
    return toClientCategory(best)
  },
  ['category-by-slug-v4'],
  { revalidate: 600, tags: ['categories'] },
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
 * Enfants d'une catégorie qui contiennent au moins 1 produit (tout fournisseur
 * confondu). Utilisé sur la route catalogue public pour masquer les sous-catégories
 * vides — pendant SAPAL de `getCategoryChildrenBySupplier`.
 * Les admins peuvent les voir via le mode édition qui appelle `getCategoryChildren`.
 */
export const getCategoryChildrenWithProducts = unstable_cache(
  async (parentId: string): Promise<ClientCategory[]> => {
    const supabase = createBrowserClient()
    const { data: children, error } = await supabase
      .from('categories')
      .select('*')
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) return []

    const childIds = (children ?? []).map((c: { id: string }) => c.id)
    // fetchProductCounts sans filter supplier → compte tous les produits
    const counts = await fetchProductCounts(supabase, childIds, null)
    return (children ?? [])
      .filter((c: { id: string }) => (counts.get(c.id) || 0) > 0)
      .map(toClientCategory)
  },
  ['category-children-with-products-v1'],
  { revalidate: 300, tags: ['categories', 'products'] },
)

/**
 * Variante admin de `getCategoryChildrenWithProducts` : retourne TOUTES les
 * sous-catégories (vides incluses) avec le compteur récursif de produits.
 * Symétrique de `getCategoryChildrenWithCountsBySupplier` mais sans filtre
 * fournisseur. Le compteur s'appuie sur la RPC `category_product_counts` qui
 * descend récursivement dans l'arbre.
 */
export const getCategoryChildrenWithCounts = unstable_cache(
  async (parentId: string): Promise<{ category: ClientCategory; count: number }[]> => {
    const supabase = createBrowserClient()
    const { data: children, error } = await supabase
      .from('categories')
      .select('*')
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) return []

    const childIds = (children ?? []).map((c: { id: string }) => c.id)
    const counts = await fetchProductCounts(supabase, childIds, null)
    return (children ?? []).map((c) => ({
      category: toClientCategory(c),
      count: counts.get(c.id) || 0,
    }))
  },
  ['category-children-with-counts-v1'],
  { revalidate: 300, tags: ['categories', 'products'] },
)

/**
 * Pour chaque catégorie fournie, retourne l'URL d'une image représentative (image
 * d'un produit au hasard dans l'arbre). Utilise la RPC Supabase `category_thumbnails`
 * pour tout résoudre en 1 seule requête au lieu d'un BFS côté client.
 */
export const getCategoryThumbnails = unstable_cache(
  async (categoryIds: string[]): Promise<Record<string, string>> => {
    if (categoryIds.length === 0) return {}
    const supabase = createBrowserClient()
    const { data } = await supabase.rpc('category_thumbnails', {
      root_ids: categoryIds,
      supplier_filter: null,
    })
    const result: Record<string, string> = {}
    for (const row of (data ?? []) as Array<{ category_id: string; image_url: string }>) {
      if (row.image_url) result[row.category_id] = row.image_url
    }
    return result
  },
  ['category-thumbnails-v2'],
  { revalidate: 600, tags: ['categories', 'products'] },
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

/**
 * Nombre total de produits dans une catégorie et toutes ses descendantes.
 * 1 RPC au lieu de charger tous les produits.
 */
export const getCategoryProductCount = unstable_cache(
  async (rootCategoryId: string, supplier?: string): Promise<number> => {
    const supabase = createBrowserClient()
    const { data } = await supabase.rpc('category_product_counts', {
      root_ids: [rootCategoryId],
      supplier_filter: supplier ?? null,
    })
    const row = (data ?? [])[0] as { product_count?: number } | undefined
    return Number(row?.product_count) || 0
  },
  ['category-product-count-v1'],
  { revalidate: 300, tags: ['categories', 'products'] },
)

/** Produits dans une catégorie et toutes ses descendantes. */
export const getProductsInCategoryTree = unstable_cache(
  async (rootCategoryId: string): Promise<ClientProduct[]> => {
    const supabase = createBrowserClient()
    const { data: descendants } = await supabase.rpc('category_descendants', {
      root_id: rootCategoryId,
    })
    const ids = (descendants ?? []).map((d: { id: string }) => d.id)
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('catalog_products')
      .select('*, categories(slug)')
      .in('category_id', ids)
      .order('name')
    if (error) return []
    return (data ?? []).map((p: Product & { categories?: { slug: string } }) => toClientProduct(p, p.categories?.slug))
  },
  ['products-in-tree-v2'],
  { revalidate: 300, tags: ['products'] },
)

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
export const getCategoryBySlugForSupplier = unstable_cache(
  async (slug: string, supplier: string): Promise<ClientCategory | null> => {
    const supabase = createBrowserClient()
    const { data: candidates } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .order('level', { ascending: false })
    if (!candidates || candidates.length === 0) return null

    // 1 RPC pour tous les counts d'un coup
    const ids = (candidates as Array<{ id: string }>).map((c) => c.id)
    const counts = await fetchProductCounts(supabase, ids, supplier)
    for (const cat of candidates) {
      if ((counts.get(cat.id) || 0) > 0) return toClientCategory(cat)
    }
    return toClientCategory(candidates[0])
  },
  ['category-by-slug-for-supplier-v2'],
  { revalidate: 300, tags: ['categories', 'products'] },
)

/**
 * Helper : 1 appel RPC qui retourne le count produits par catégorie (filtré supplier).
 * Remplace N requêtes COUNT successives par 1 seule côté SQL.
 */
async function fetchProductCounts(
  supabase: ReturnType<typeof createBrowserClient>,
  rootIds: string[],
  supplier: string | null,
): Promise<Map<string, number>> {
  if (rootIds.length === 0) return new Map()
  const { data } = await supabase.rpc('category_product_counts', {
    root_ids: rootIds,
    supplier_filter: supplier,
  })
  const map = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ category_id: string; product_count: number }>) {
    map.set(row.category_id, Number(row.product_count) || 0)
  }
  // Catégories sans produit : retournées avec count=0 implicite (absentes de la map)
  for (const id of rootIds) if (!map.has(id)) map.set(id, 0)
  return map
}

/**
 * Renvoie les catégories racine (niveau 1) contenant AU MOINS un produit du
 * fournisseur donné. Utilisé pour `/catalogue/fournisseurs/procity`.
 *
 * Performance : 2 requêtes (SELECT roots + 1 RPC count) au lieu de N+1.
 */
export const getCategoriesBySupplier = unstable_cache(
  async (supplier: string): Promise<ClientCategory[]> => {
    const supabase = createBrowserClient()
    const { data: roots, error } = await supabase
      .from('categories')
      .select('*')
      .is('parent_id', null)
      .not('universe', 'is', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) return []

    const rootIds = (roots ?? []).map((r: { id: string }) => r.id)
    const counts = await fetchProductCounts(supabase, rootIds, supplier)
    return (roots ?? [])
      .filter((r: { id: string }) => (counts.get(r.id) || 0) > 0)
      .map(toClientCategory)
  },
  ['categories-by-supplier-v2'],
  { revalidate: 300, tags: ['categories', 'products'] },
)

/** Enfants d'une catégorie qui contiennent au moins 1 produit du supplier. */
export const getCategoryChildrenBySupplier = unstable_cache(
  async (parentId: string, supplier: string): Promise<ClientCategory[]> => {
    const supabase = createBrowserClient()
    const { data: children, error } = await supabase
      .from('categories')
      .select('*')
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) return []

    const childIds = (children ?? []).map((c: { id: string }) => c.id)
    const counts = await fetchProductCounts(supabase, childIds, supplier)
    return (children ?? [])
      .filter((c: { id: string }) => (counts.get(c.id) || 0) > 0)
      .map(toClientCategory)
  },
  ['category-children-by-supplier-v2'],
  { revalidate: 300, tags: ['categories', 'products'] },
)

/**
 * Tous les enfants d'une catégorie (vides inclus) + leur count produits.
 * Utilisé côté admin pour afficher les catégories sans produits.
 */
export const getCategoryChildrenWithCountsBySupplier = unstable_cache(
  async (parentId: string, supplier: string): Promise<{ category: ClientCategory; count: number }[]> => {
    const supabase = createBrowserClient()
    const { data: children, error } = await supabase
      .from('categories')
      .select('*')
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) return []

    const childIds = (children ?? []).map((c) => c.id)
    const counts = await fetchProductCounts(supabase, childIds, supplier)
    return (children ?? []).map((c) => ({
      category: toClientCategory(c),
      count: counts.get(c.id) || 0,
    }))
  },
  ['category-children-with-counts-by-supplier-v1'],
  { revalidate: 300, tags: ['categories', 'products'] },
)

/** Produits d'une catégorie (et descendants) filtrés par fournisseur. */
export const getProductsInCategoryTreeBySupplier = unstable_cache(
  async (rootCategoryId: string, supplier: string): Promise<ClientProduct[]> => {
    const supabase = createBrowserClient()
    // 1 RPC pour récupérer tous les descendants, puis 1 SELECT produits filtrés
    const { data: descendants } = await supabase.rpc('category_descendants', {
      root_id: rootCategoryId,
    })
    const ids = (descendants ?? []).map((d: { id: string }) => d.id)
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('catalog_products')
      .select('*, categories(slug)')
      .in('category_id', ids)
      .eq('supplier', supplier)
      .order('name')
    if (error) return []
    return (data ?? []).map((p: Product & { categories?: { slug: string } }) =>
      toClientProduct(p, p.categories?.slug),
    )
  },
  ['products-in-tree-by-supplier-v2'],
  { revalidate: 300, tags: ['products'] },
)

/** Vignettes catégorie (image produit descendant) filtrées par fournisseur. */
export const getCategoryThumbnailsBySupplier = unstable_cache(
  async (categoryIds: string[], supplier: string): Promise<Record<string, string>> => {
    if (categoryIds.length === 0) return {}
    const supabase = createBrowserClient()
    const { data } = await supabase.rpc('category_thumbnails', {
      root_ids: categoryIds,
      supplier_filter: supplier,
    })
    const result: Record<string, string> = {}
    for (const row of (data ?? []) as Array<{ category_id: string; image_url: string }>) {
      if (row.image_url) result[row.category_id] = row.image_url
    }
    return result
  },
  ['category-thumbs-by-supplier-v2'],
  { revalidate: 600, tags: ['categories', 'products'] },
)

export const getProductsByCategory = unstable_cache(
  async (categoryId: string): Promise<ClientProduct[]> => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('catalog_products')
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
    // PostgREST plafonne à 1000 lignes par requête côté Supabase (db.max_rows).
    // On a 1300+ produits → il faut paginer en boucle côté client pour tout
    // récupérer, sinon ~300 fiches sont silencieusement exclues du sitemap
    // et de la recherche publique.
    const PAGE = 1000
    const all: (Product & { categories?: { slug: string } })[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(slug)')
        .order('name')
        .range(from, from + PAGE - 1)
      if (error) throw error
      const batch = data ?? []
      all.push(...(batch as typeof all))
      if (batch.length < PAGE) break
    }
    return all.map((p) => toClientProduct(p, p.categories?.slug))
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
      .from('catalog_products')
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
    .from('catalog_products')
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
    .from('catalog_products')
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
    const escapedQuery = escapePostgrestLikePattern(query)
    q = q.or(`name.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%,reference.ilike.%${escapedQuery}%`)
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
      .from('catalog_products')
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
