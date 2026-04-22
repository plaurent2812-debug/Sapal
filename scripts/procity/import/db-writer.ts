import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductSnapshot, VariantSnapshot } from '../scraper/types';
import type { ProductFromExcel, TarifVariantRow } from './excel-parser';

/**
 * Entrée d'import pour UN produit canonique (qui peut regrouper plusieurs refs Excel
 * partageant la même URL Procity).
 */
export interface ImportInput {
  /** Refs Excel partageant la même URL Procity ; le premier élément est la ref canonique. */
  excelGroup: ProductFromExcel[];
  snapshot: ProductSnapshot | null;
  descriptionSapal: string | null;
  galleryUrls: string[];
  /** Map : variantKey (ref Excel ou variantRef snapshot) → URL Storage */
  variantImageUrls: Record<string, string>;
  techSheetUrl: string | null;
  supplierId: string;
}

/**
 * Upsert idempotent d'un produit canonique + variantes dérivées.
 *
 * Un "produit canonique" regroupe toutes les refs Excel qui pointent vers la même URL
 * Procity. Les refs distinctes (ex: Héritage 206130..206153 = 12 refs) deviennent des
 * variantes d'UN seul produit avec axes (longueur, crosse, structure) dérivés Excel,
 * multipliés par coloris depuis le snapshot.
 *
 * products.id = ref canonique (premier élément de excelGroup)
 * product_variants.reference = ref Excel + suffixe coloris si coloris vient du snapshot
 */
export async function upsertProduct(
  supabase: SupabaseClient,
  input: ImportInput,
): Promise<{ productId: string; action: 'insert' | 'update'; variantCount: number }> {
  const { excelGroup, snapshot, descriptionSapal, galleryUrls, variantImageUrls, techSheetUrl, supplierId } = input;
  if (excelGroup.length === 0) throw new Error('excelGroup vide');

  const canonical = excelGroup[0];
  const productId = canonical.reference;

  // Cherche produit existant — priorité à l'id canonique puis fallback supplier+reference
  const { data: existingById } = await supabase
    .from('products')
    .select('id, name, description, image_url, slug, gallery_image_urls')
    .eq('id', productId)
    .maybeSingle();
  const existing = existingById;

  const title = canonicalTitle(canonical, snapshot);
  // Slug : si le slug de base est déjà pris par un AUTRE produit, on suffixe
  // avec la ref canonique pour garantir l'unicité. Cela évite les fails sur la
  // contrainte `products_slug_key` quand 2 URLs Procity ont le même titre court.
  let slug: string;
  if (existing?.slug) {
    slug = existing.slug;
  } else {
    const baseSlug = slugifyCanonical(title);
    const { data: slugCollision } = await supabase
      .from('products')
      .select('id')
      .eq('slug', baseSlug)
      .neq('id', productId)
      .maybeSingle();
    slug = slugCollision ? `${baseSlug}-${productId}` : baseSlug;
  }
  const rawDescription = snapshot?.descriptionRaw || '';

  const specifications: Record<string, string> = {};
  if (snapshot?.characteristics) {
    for (const c of snapshot.characteristics) specifications[c.label] = c.value;
  }
  // Dimensions/Poids/Type : on prend de la ref canonique en premier (plus représentatif)
  const firstVariant = canonical.variants[0];
  if (firstVariant?.dimensions && !specifications.Dimensions) {
    specifications.Dimensions = firstVariant.dimensions;
  }
  if (firstVariant?.weightKg && !specifications.Poids) {
    specifications.Poids = `${firstVariant.weightKg} kg`;
  }
  if (canonical.productType && !specifications.Type) {
    specifications.Type = canonical.productType;
  }

  // Prix affiché = min des prix du groupe (prix "à partir de")
  const allPrices = excelGroup
    .flatMap((p) => p.variants.map((v) => v.priceNetHt || v.pricePublicHt || 0))
    .filter((p) => p > 0);
  const basePrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;

  const categoryId = existing ? undefined : await resolveCategoryId(supabase, canonical);

  const payload: Record<string, unknown> = {
    supplier_id: supplierId,
    supplier: 'procity',
    reference: productId,
    name: title,
    slug,
    description: rawDescription || existing?.description || '',
    description_sapal: descriptionSapal,
    description_source_hash: snapshot?.contentHash || null,
    procity_url: canonical.procityUrl || null,
    procity_family: canonical.category || null,
    procity_type: canonical.productType || null,
    specifications,
    gallery_image_urls: galleryUrls.length ? galleryUrls : existing?.gallery_image_urls || [],
    tech_sheet_url: techSheetUrl,
    last_scraped_at: snapshot?.scrapedAt || null,
  };

  if (basePrice > 0) payload.price = basePrice;
  if (!existing?.image_url && galleryUrls.length > 0) {
    payload.image_url = galleryUrls[0];
  }

  let action: 'insert' | 'update';
  if (existing) {
    const { error } = await supabase.from('products').update(payload).eq('id', productId);
    if (error) throw new Error(`update product ${productId}: ${error.message}`);
    action = 'update';
  } else {
    payload.id = productId;
    if (categoryId) payload.category_id = categoryId;
    const { error } = await supabase.from('products').insert(payload);
    if (error) throw new Error(`insert product ${productId}: ${error.message}`);
    action = 'insert';
  }

  const variantCount = await rewriteVariants(supabase, productId, excelGroup, snapshot, variantImageUrls);

  return { productId, action, variantCount };
}

/**
 * Reconstruit complètement les variantes du produit canonique.
 *
 * Stratégie :
 * 1. DELETE toutes les variantes existantes du product_id (on refait tout proprement).
 * 2. Pour chaque ref Excel du groupe : extraire (longueur, crosse, structure) depuis les
 *    colonnes Excel.
 * 3. Si le snapshot existe, multiplier chaque ref Excel par les coloris du snapshot qui
 *    matchent (longueur, crosse, structure).
 * 4. Sinon, 1 seule variante par ref Excel (coloris Standard).
 */
async function rewriteVariants(
  supabase: SupabaseClient,
  productId: string,
  excelGroup: ProductFromExcel[],
  snapshot: ProductSnapshot | null,
  variantImageUrls: Record<string, string>,
): Promise<number> {
  // Purge : on supprime tout pour reconstruire proprement (pas de diff partiel)
  const { error: delErr } = await supabase
    .from('product_variants')
    .delete()
    .eq('product_id', productId);
  if (delErr) throw new Error(`delete variants ${productId}: ${delErr.message}`);

  const rows: VariantRow[] = [];

  for (const excel of excelGroup) {
    for (const ev of excel.variants) {
      const longueur = extractLongueur(ev);
      const crosse = extractCrosse(ev);
      const structure = extractStructure(excel, ev);

      // Coloris depuis le snapshot qui match cette combinaison ; sinon "Standard"
      const matchingColors = snapshot
        ? findMatchingColors(snapshot.variants, { longueur, crosse, structure })
        : [];

      if (matchingColors.length === 0) {
        // 1 variante unique — coloris Excel (souvent "Standard")
        rows.push(buildRow({
          excelRef: ev.reference,
          coloris: normalizeColoris(ev.coloris) || 'Standard',
          longueur,
          crosse,
          structure,
          dimensions: ev.dimensions || '',
          weightKg: ev.weightKg,
          price: ev.priceNetHt || ev.pricePublicHt || null,
          delai: ev.delai || '',
          primaryImage: variantImageUrls[ev.reference] || null,
          attrs: {},
        }));
      } else {
        // Multi-coloris depuis snapshot
        for (const sv of matchingColors) {
          const coloris = normalizeColoris(sv.attributes.Couleur || sv.attributes.couleur);
          if (!coloris) continue;
          // Lookup image :
          //  1) Priorité ABSOLUE : `${refExcel}__${coloris}` — cette clé, quand
          //     elle existe, provient du fallback "nom de fichier" qui matche
          //     un fichier `<hash>-<refExcel>_<colorCode>_<n>.ext` — c'est la
          //     photo exacte de CETTE variante Excel (car Procity nomme ses fichiers
          //     avec la ref produit qu'ils représentent). Toujours la plus précise.
          //  2) Fallback : clé combo (couleur × structure × longueur × crosse) venant
          //     du mapping par clic du scraper. Moins fiable car Procity partage
          //     parfois la même photo entre 2 combinaisons.
          //  3) Dernier fallback : variantRef snapshot.
          const svStructure = sv.attributes.Structure || '';
          const svLongueur = sv.attributes.Longueur || sv.attributes['Longueur (mm)'] || '';
          const svCrosse = sv.attributes['Structure autre'] || sv.attributes.Crosse || '';
          const comboKey = makeComboKey(coloris, svStructure, svLongueur, svCrosse);
          const primary =
            variantImageUrls[`${ev.reference}__${coloris}`] ||
            variantImageUrls[`${ev.reference}__${comboKey}`] ||
            variantImageUrls[sv.variantRef] ||
            null;
          rows.push(buildRow({
            excelRef: ev.reference,
            coloris,
            longueur,
            crosse,
            structure,
            dimensions: ev.dimensions || '',
            weightKg: sv.weightKg ?? ev.weightKg,
            price: ev.priceNetHt || ev.pricePublicHt || null,
            delai: sv.availability || ev.delai || '',
            primaryImage: primary,
            attrs: sv.attributes,
          }));
        }
      }
    }
  }

  // Dédupliquer sur (reference, coloris, finition) — la contrainte naturelle.
  // En cas de collision on garde la première.
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const key = `${r.reference}||${r.coloris}||${r.finition}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Insert bulk — après delete on peut insert sans onConflict
  if (deduped.length === 0) return 0;
  const payload = deduped.map((r) => ({
    product_id: productId,
    reference: r.reference,
    label: r.label,
    coloris: r.coloris,
    finition: r.finition,
    dimensions: r.dimensions,
    poids: r.poids,
    price: r.price ?? 0,
    delai: r.delai,
    images: [],
    primary_image_url: r.primary_image_url,
    specifications: r.specifications,
  }));

  const { error } = await supabase.from('product_variants').insert(payload);
  if (error) throw new Error(`insert variants ${productId}: ${error.message}`);
  return deduped.length;
}

interface VariantRow {
  reference: string;
  coloris: string;
  finition: string;         // encode la crosse (SANS/SIMPLE/DOUBLE CROSSE)
  dimensions: string;       // longueur affichable (ex: "800 mm")
  poids: string;
  price: number | null;
  delai: string;
  primary_image_url: string | null;
  specifications: Record<string, string>;
  label: string;
}

interface BuildRowInput {
  excelRef: string;
  coloris: string;
  longueur: string;
  crosse: string;
  structure: string;
  dimensions: string;
  weightKg?: number;
  price: number | null;
  delai: string;
  primaryImage: string | null;
  attrs: Record<string, string>;
}

function buildRow(i: BuildRowInput): VariantRow {
  // `finition` DB = uniquement la Crosse (axe UI "Crosse"). Si le produit n'a pas
  // d'axe crosse dans l'Excel (ex: Lisbonne qui a Structure mais pas Crosse), on
  // laisse vide pour que le sélecteur Crosse ne se déclenche pas côté front
  // (il n'active un axe que s'il y a 2+ valeurs distinctes).
  const finition = i.crosse || '';
  // dimensions DB = longueur affichable (pas "800 mm" mais juste ce que la ref porte)
  const dimensions = i.longueur || i.dimensions;
  const specifications: Record<string, string> = { ...i.attrs };
  if (i.structure) specifications.Structure = i.structure;
  if (i.crosse) specifications.Crosse = i.crosse;

  return {
    reference: i.excelRef,
    coloris: i.coloris,
    finition,
    dimensions,
    poids: i.weightKg ? `${i.weightKg} kg` : '',
    price: i.price,
    delai: i.delai,
    primary_image_url: i.primaryImage,
    specifications,
    label: buildLabel({ coloris: i.coloris, longueur: i.longueur, crosse: i.crosse, structure: i.structure }),
  };
}

/**
 * Cherche dans les variantes snapshot celles qui matchent (longueur, crosse, structure).
 * On utilise un matching tolérant car les libellés Excel/Procity peuvent différer
 * ("800 mm" vs "800", "SIMPLE CROSSE" vs "Simple crosse", etc.)
 */
function findMatchingColors(
  snapshotVariants: VariantSnapshot[],
  target: { longueur: string; crosse: string; structure: string },
): VariantSnapshot[] {
  const normLong = normalizeToken(target.longueur);
  const normCrosse = normalizeToken(target.crosse);
  const normStruct = normalizeToken(target.structure);

  return snapshotVariants.filter((sv) => {
    const svLong = normalizeToken(
      sv.attributes['Longueur'] || sv.attributes['Longueur (mm)'] || '',
    );
    const svCrosse = normalizeToken(
      sv.attributes['Structure autre'] || sv.attributes['Crosse'] || '',
    );
    const svStruct = normalizeToken(sv.attributes['Structure'] || '');

    // Longueur : match tolérant (800 dans "800 mm" etc.)
    if (normLong && svLong && !tokensMatch(normLong, svLong)) return false;
    // Crosse : match si présent des deux côtés
    if (normCrosse && svCrosse && !tokensMatch(normCrosse, svCrosse)) return false;
    // Structure : match si présent des deux côtés
    if (normStruct && svStruct && !tokensMatch(normStruct, svStruct)) return false;
    return true;
  });
}

function normalizeToken(s: string | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

/** Extrait la longueur depuis les champs Excel (ex: "800 mm" → "800 mm"). */
function extractLongueur(ev: TarifVariantRow): string {
  if (!ev.dimensions) return '';
  // Si dimensions contient mm, c'est déjà une longueur ; sinon on garde tel quel
  return ev.dimensions.trim();
}

/** Extrait la crosse depuis la colonne finition Excel. */
function extractCrosse(ev: TarifVariantRow): string {
  if (!ev.finition) return '';
  const t = ev.finition.trim();
  if (t === '-' || t === '') return '';
  // Harmonise la casse : "SIMPLE CROSSE" → "Simple crosse"
  if (/crosse/i.test(t)) return toTitleCase(t);
  return toTitleCase(t);
}

/** Extrait la structure depuis le suffixe de designationFull Excel. */
function extractStructure(_excel: ProductFromExcel, ev: TarifVariantRow): string {
  const full = (ev.designationFull || '').toUpperCase();
  const short = (ev.designationShort || '').toUpperCase();
  // Le suffixe après le nom court
  const suffix = full.replace(short, '').trim();
  if (!suffix) return '';
  // Harmoniser les appellations les plus courantes
  if (/AVEC\s+ROSACE/.test(suffix)) return 'Avec rosace';
  if (/SIMPLE\s+CROIX/.test(suffix)) return 'Simple croix';
  if (/DOUBLE\s+CROIX/.test(suffix)) return 'Double croix';
  if (/GRILLAG/.test(suffix)) return 'Grillagée';
  if (/BARREAUD/.test(suffix)) return 'Barreaudée';
  return toTitleCase(suffix);
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function canonicalTitle(canonical: ProductFromExcel, snapshot: ProductSnapshot | null): string {
  if (snapshot?.title) return snapshot.title;
  // Titre = designationShort en Title Case, sans suffixe de structure
  if (canonical.designationShort) {
    return toTitleCase(canonical.designationShort);
  }
  return `Produit ${canonical.reference}`;
}

function slugifyCanonical(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100);
}

function normalizeColoris(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed === 'Standard' || trimmed === '-') return trimmed === '-' ? '' : trimmed;
  const ral = trimmed.match(/^RAL\s*(\d{4})$/i);
  if (ral) return ral[1];
  return trimmed;
}

function buildLabel(i: { coloris: string; longueur: string; crosse: string; structure: string }): string {
  const parts: string[] = [];
  if (i.structure) parts.push(i.structure);
  if (i.crosse) parts.push(i.crosse);
  if (i.longueur) parts.push(i.longueur);
  if (i.coloris) {
    const display = /^\d{4}$/.test(i.coloris) ? `RAL ${i.coloris}` : i.coloris;
    parts.push(display);
  }
  return parts.join(' — ') || '—';
}

/* -------------------------------------------------------------------------- */
/* Resolution catégorie Procity (niveau 3 de la taxonomie seedée)              */
/* -------------------------------------------------------------------------- */

import { makeTypeId, slugify, makeCategoryId, makeUniverseId } from './seed-categories';
import { makeComboKey } from './variant-keys';

const categoryCache = new Map<string, string>();

/**
 * Résout l'ID de catégorie niveau 3 (Type de produit) depuis les colonnes Excel.
 * Chaîne de fallback : type → catégorie parent → univers (toujours trouvé car seedé).
 */
async function resolveCategoryId(
  supabase: SupabaseClient,
  excel: ProductFromExcel,
): Promise<string> {
  const universe = excel.universe;
  const catName = (excel.category || '').trim();
  const typeName = (excel.productType || '').trim();

  const candidates: string[] = [];
  if (catName && typeName) {
    candidates.push(makeTypeId(universe, slugify(catName), slugify(typeName)));
  }
  if (catName) {
    candidates.push(makeCategoryId(universe, slugify(catName)));
  }
  candidates.push(makeUniverseId(universe));

  for (const id of candidates) {
    const cached = categoryCache.get(id);
    if (cached) return cached;
    const { data } = await supabase.from('categories').select('id').eq('id', id).maybeSingle();
    if (data?.id) {
      categoryCache.set(id, data.id);
      return data.id;
    }
  }
  throw new Error(
    `categorie introuvable pour universe=${universe} cat=${catName} type=${typeName}`,
  );
}
