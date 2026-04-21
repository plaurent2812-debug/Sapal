import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductSnapshot } from '../scraper/types';
import type { ProductFromExcel, TarifVariantRow } from './excel-parser';

export interface ImportInput {
  excel: ProductFromExcel;
  snapshot: ProductSnapshot | null;      // null si pas de scraping dispo
  descriptionSapal: string | null;       // null si LLM skippé
  galleryUrls: string[];                 // URLs Storage (photos produit)
  variantImageUrls: Record<string, string>; // variantRef -> URL Storage
  techSheetUrl: string | null;           // PDF Storage
  supplierId: string;                    // UUID supplier Procity
}

/**
 * Upsert idempotent produit + variantes.
 *
 * Stratégie : la PK de products est `text` et n'a pas de contrainte unique sur `reference`.
 * On SELECT d'abord par (supplier_id, reference), on UPDATE si trouvé, INSERT sinon.
 * Pour les variantes, on utilise la contrainte naturelle product_variants_natural_key_unique
 * (product_id, reference, coloris, finition) via onConflict.
 */
export async function upsertProduct(
  supabase: SupabaseClient,
  input: ImportInput,
): Promise<{ productId: string; action: 'insert' | 'update' }> {
  const { excel, snapshot, descriptionSapal, galleryUrls, variantImageUrls, techSheetUrl, supplierId } = input;
  const ref = excel.reference;

  // Cherche produit existant — d'abord par supplier_id + reference
  const { data: existing, error: selectErr } = await supabase
    .from('products')
    .select('id, name, description, image_url, slug, gallery_image_urls')
    .eq('supplier_id', supplierId)
    .eq('reference', ref)
    .maybeSingle();
  if (selectErr) throw new Error(`select product ${ref}: ${selectErr.message}`);

  const title = snapshot?.title || excel.designationShort || excel.designationFull || `Produit ${ref}`;
  const slug = existing?.slug || slugify(`${title} ${ref}`);
  const rawDescription = snapshot?.descriptionRaw || '';

  // specifications : merge snapshot.characteristics (prioritaire) + infos Excel (dimensions/poids)
  const specifications: Record<string, string> = {};
  if (snapshot?.characteristics) {
    for (const c of snapshot.characteristics) specifications[c.label] = c.value;
  }
  if (excel.variants[0]?.dimensions && !specifications.Dimensions) {
    specifications.Dimensions = excel.variants[0].dimensions;
  }
  if (excel.variants[0]?.weightKg && !specifications.Poids) {
    specifications.Poids = `${excel.variants[0].weightKg} kg`;
  }
  if (excel.productType && !specifications.Type) {
    specifications.Type = excel.productType;
  }

  const procityFamily = excel.category || null;
  const procityType = excel.productType || null;
  const basePrice = excel.variants[0]?.priceNetHt || excel.variants[0]?.pricePublicHt || 0;

  const payload: Record<string, unknown> = {
    supplier_id: supplierId,
    supplier: 'procity',
    reference: ref,
    name: title,
    slug,
    description: rawDescription || existing?.description || '',
    description_sapal: descriptionSapal,
    description_source_hash: snapshot?.contentHash || null,
    procity_url: excel.procityUrl || null,
    procity_family: procityFamily,
    procity_type: procityType,
    specifications,
    gallery_image_urls: galleryUrls.length ? galleryUrls : existing?.gallery_image_urls || [],
    tech_sheet_url: techSheetUrl,
    last_scraped_at: snapshot?.scrapedAt || null,
  };

  if (basePrice > 0) payload.price = basePrice;

  // image_url : on ne l'écrase que si elle est vide ET qu'on a une galerie
  if (!existing?.image_url && galleryUrls.length > 0) {
    payload.image_url = galleryUrls[0];
  }

  let productId: string;
  let action: 'insert' | 'update';

  if (existing) {
    const { error } = await supabase.from('products').update(payload).eq('id', existing.id);
    if (error) throw new Error(`update product ${ref}: ${error.message}`);
    productId = existing.id;
    action = 'update';
  } else {
    // Nouveau produit : on utilise la reference comme id (products.id est text)
    payload.id = ref;
    const { error } = await supabase.from('products').insert(payload);
    if (error) throw new Error(`insert product ${ref}: ${error.message}`);
    productId = ref;
    action = 'insert';
  }

  await upsertVariants(supabase, productId, excel.variants, snapshot, variantImageUrls);

  return { productId, action };
}

async function upsertVariants(
  supabase: SupabaseClient,
  productId: string,
  excelVariants: TarifVariantRow[],
  snapshot: ProductSnapshot | null,
  variantImageUrls: Record<string, string>,
): Promise<void> {
  // Stratégie : l'Excel est source de vérité pour les prix/délais/coloris.
  // Le snapshot complète avec les sous-variantes scrapées (ex: 10 couleurs pour 1 ligne Excel).
  //
  // Cas 1 : Excel a plusieurs lignes (ex: Lisbonne avec Standard+3004+6005)
  //   → chaque ligne Excel = 1 variante
  // Cas 2 : Excel a 1 ligne "Standard" mais snapshot a 10 couleurs
  //   → on prend les 10 variantes du snapshot, avec prix/délai de la ligne Excel
  // Cas 3 : Excel a 1 ligne et pas de scraping
  //   → 1 variante "Standard"

  const variantsToWrite: Array<{
    reference: string;
    coloris: string;
    finition: string;
    dimensions: string;
    poids: string;
    price: number | null;
    delai: string;
    images: string[];
    primary_image_url: string | null;
    specifications: Record<string, string>;
  }> = [];

  // Map snapshot variants by their variant ref (ex: 529777.GPRO)
  const snapshotByRef = new Map<string, { couleur: string; attributes: Record<string, string>; imageFilenames: string[] }>();
  if (snapshot) {
    for (const v of snapshot.variants) {
      snapshotByRef.set(v.variantRef, {
        couleur: v.attributes.Couleur || v.attributes.couleur || '',
        attributes: v.attributes,
        imageFilenames: v.imageFilenames,
      });
    }
  }

  // Si Excel a plusieurs variantes distinctes : Excel est source
  if (excelVariants.length > 1) {
    for (const ev of excelVariants) {
      variantsToWrite.push({
        reference: ev.reference,
        coloris: ev.coloris || '',
        finition: ev.finition || '',
        dimensions: ev.dimensions || '',
        poids: ev.weightKg ? `${ev.weightKg} kg` : '',
        price: ev.priceNetHt || ev.pricePublicHt || null,
        delai: ev.delai || '',
        images: [],
        primary_image_url: variantImageUrls[ev.reference] || null,
        specifications: {},
      });
    }
  } else if (snapshot && snapshot.variants.length > 0) {
    // Excel 1 ligne mais snapshot expose plusieurs variantes : on prend le snapshot comme source
    const excelBase = excelVariants[0];
    for (const sv of snapshot.variants) {
      variantsToWrite.push({
        reference: sv.variantRef,
        coloris: sv.attributes.Couleur || sv.attributes.couleur || excelBase?.coloris || '',
        finition: sv.attributes.Finition || sv.attributes['Finition du bois'] || excelBase?.finition || '',
        dimensions: excelBase?.dimensions || '',
        poids: excelBase?.weightKg ? `${excelBase.weightKg} kg` : '',
        price: excelBase?.priceNetHt || excelBase?.pricePublicHt || null,
        delai: sv.availability || excelBase?.delai || '',
        images: [],
        primary_image_url: variantImageUrls[sv.variantRef] || null,
        specifications: sv.attributes,
      });
    }
  } else if (excelVariants.length === 1) {
    const ev = excelVariants[0];
    variantsToWrite.push({
      reference: ev.reference,
      coloris: ev.coloris || '',
      finition: ev.finition || '',
      dimensions: ev.dimensions || '',
      poids: ev.weightKg ? `${ev.weightKg} kg` : '',
      price: ev.priceNetHt || ev.pricePublicHt || null,
      delai: ev.delai || '',
      images: [],
      primary_image_url: null,
      specifications: {},
    });
  }

  // Upsert en bulk avec onConflict sur la clé naturelle
  for (const v of variantsToWrite) {
    const { error } = await supabase.from('product_variants').upsert(
      {
        product_id: productId,
        reference: v.reference,
        coloris: v.coloris,
        finition: v.finition,
        dimensions: v.dimensions,
        poids: v.poids,
        price: v.price,
        delai: v.delai,
        images: v.images,
        primary_image_url: v.primary_image_url,
        specifications: v.specifications,
      },
      { onConflict: 'product_id,reference,coloris,finition' },
    );
    if (error) throw new Error(`upsert variant ${v.reference}/${v.coloris}: ${error.message}`);
  }
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100);
}
