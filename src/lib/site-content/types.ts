/**
 * Types partagés pour le mode édition in-page (site_content).
 *
 * Une entrée site_content peut contenir plusieurs formats de valeurs :
 * - texte court ou long : string
 * - image : { url, alt }
 * - liste structurée : array d'objets
 * - CTA : { label, href }
 *
 * Le format stocké en JSONB n'est pas strict côté BDD ; les wrappers frontend
 * connaissent le format attendu pour chaque clé.
 */

export type TextValue = string

export interface ImageValue {
  url: string
  alt: string
}

export interface CTAValue {
  label: string
  href: string
}

export type ListItem = Record<string, string | number | boolean | null | undefined>
export type ListValue = ListItem[]

export type ContentValue = TextValue | ImageValue | CTAValue | ListValue | null

export interface SiteContentRow {
  key: string
  page: string
  published_value: ContentValue
  draft_value: ContentValue
  updated_at: string
  updated_by: string | null
}

/** Mapping `page` → chemin(s) Next.js à revalider après publish. */
export const PAGE_REVALIDATE_PATHS: Record<string, string[]> = {
  home: ['/'],
  about: ['/qui-sommes-nous'],
  realisations: ['/realisations'],
  contact: ['/contact'],
  cgv: ['/cgv'],
  // layout: chargé dans toutes les pages publiques → on revalide la home (layout is shared)
  footer: ['/'],
  header: ['/'],
}

export function pagePathsFor(pages: string[]): string[] {
  const paths = new Set<string>()
  for (const p of pages) {
    const mapped = PAGE_REVALIDATE_PATHS[p]
    if (mapped) mapped.forEach(path => paths.add(path))
    // Les pages catégories sont dynamiques : key `category.{slug}` → path `/catalogue/{slug}`
    if (p.startsWith('category.')) {
      const slug = p.slice('category.'.length)
      if (slug) paths.add(`/catalogue/${slug}`)
    }
  }
  return Array.from(paths)
}
