import { load } from 'cheerio';

type CheerioAPI = ReturnType<typeof load>;
import { createHash } from 'crypto';
import type {
  ProductSnapshot,
  VariantSnapshot,
  CharacteristicRow,
  Universe,
} from './types';

export interface ExtractInput {
  html: string;
  url: string;
}

interface ProcityPSE {
  id: number;
  ref: string;
  weight: number;
  combination: Record<string, number>;
  disponibility?: string;
}

interface ProcityAttributeValue {
  id: number;
  label: string;
  value: number;
  color?: string;
}

interface ProcityAttribute {
  title: string;
  id: number;
  values: ProcityAttributeValue[];
  colorTemplate?: boolean;
}

export function extractProductSnapshot(input: ExtractInput): ProductSnapshot {
  const $ = load(input.html);

  const reference = extractReference($, input.url);
  const title = extractTitle($);
  const { universe, categoryPath } = extractCategory($);
  const descriptionRaw = extractDescription($);
  const { weightKg, characteristics } = extractCharacteristics($);
  const { variants, availabilityDefault } = extractVariants($);
  const galleryFilenames = extractGalleryFilenames($, reference);
  const techSheetFilename = extractTechSheet($);

  const hashable = {
    reference,
    title,
    descriptionRaw,
    availabilityDefault,
    weightKg,
    characteristics,
    variants,
    galleryFilenames,
    techSheetFilename,
  };

  return {
    reference,
    procityUrl: input.url,
    universe,
    categoryPath,
    title,
    descriptionRaw,
    availabilityDefault,
    weightKg,
    dimensions: characteristics.find((c) => /dimensions?/i.test(c.label))?.value,
    type: characteristics.find((c) => /^type$/i.test(c.label))?.value,
    characteristics,
    variants,
    galleryFilenames,
    techSheetFilename,
    scrapedAt: new Date().toISOString(),
    contentHash: 'sha256:' + createHash('sha256').update(JSON.stringify(hashable)).digest('hex'),
  };
}

function extractReference($: CheerioAPI, url: string): string {
  const dataLayerMatch = $.html().match(/"ecomm_prodid":\["?(\d{5,7})"?\]/);
  if (dataLayerMatch) return dataLayerMatch[1];

  const textMatch = $('body').text().match(/R[ée]f[ée]rence\s+(\d{5,7})/i);
  if (textMatch) return textMatch[1];

  const urlMatch = url.match(/(\d{5,7})(?:-\d+)?\.html$/);
  if (urlMatch) return urlMatch[1];

  throw new Error(`No reference found in ${url}`);
}

function extractTitle($: CheerioAPI): string {
  return $('h1').first().text().trim();
}

function extractCategory($: CheerioAPI): { universe: Universe; categoryPath: string[] } {
  const categoryPath: string[] = [];

  const itemCat1 = $.html().match(/"item_category":"([^"]+)"/)?.[1];
  const itemCat2 = $.html().match(/"item_category2":"([^"]+)"/)?.[1];
  const itemCat3 = $.html().match(/"item_category3":"([^"]+)"/)?.[1];
  [itemCat1, itemCat2, itemCat3].forEach((c) => {
    if (c) categoryPath.push(decodeHtmlEntities(c));
  });

  if (categoryPath.length === 0) {
    $('[itemprop="itemListElement"] [itemprop="name"], nav a').each((_, el) => {
      const t = $(el).text().trim();
      if (t && t.toLowerCase() !== 'accueil' && !categoryPath.includes(t)) categoryPath.push(t);
    });
  }

  const first = (categoryPath[0] || '').toLowerCase();
  let universe: Universe = 'mobilier-urbain';
  if (first.includes('aires de jeux') || first.includes('aire de jeux')) universe = 'aires-de-jeux';
  else if (first.includes('sportif')) universe = 'equipements-sportifs';

  return { universe, categoryPath };
}

function extractDescription($: CheerioAPI): string {
  const panelDesc = $('.ProductFormPanel-actions').nextAll('.para2-r').first().text().trim();
  const wysiwyg = $('.Product-description, .wysiwyg').first().text().trim();
  const primary = [panelDesc, wysiwyg].filter(Boolean).join('\n\n').trim();
  if (primary.length > 50) return collapseWhitespace(primary);

  const meta = $('meta[name="description"]').attr('content') || '';
  return collapseWhitespace(meta);
}

function extractCharacteristics($: CheerioAPI): {
  weightKg?: number;
  characteristics: CharacteristicRow[];
} {
  const characteristics: CharacteristicRow[] = [];

  $('.Concertina').each((_, details) => {
    const h2 = $(details).find('.Concertina__header h2').first().text().trim().toLowerCase();
    if (!h2.includes('caract')) return;
    $(details)
      .find('.para2-b')
      .each((_i, labelEl) => {
        const label = $(labelEl).text().trim();
        const value = $(labelEl).next('.para2-r').text().trim();
        if (label && value && !characteristics.find((c) => c.label === label)) {
          characteristics.push({ label, value: collapseWhitespace(value) });
        }
      });
  });

  const pseMatch = $.html().match(/var\s+PSES\s*=\s*(\[[\s\S]*?\]);/);
  let weightKg: number | undefined;
  if (pseMatch) {
    try {
      const pses: ProcityPSE[] = JSON.parse(pseMatch[1]);
      const weights = [...new Set(pses.map((p) => p.weight).filter(Boolean))];
      if (weights.length >= 1) weightKg = weights[0];
    } catch {
      /* ignore JSON errors */
    }
  }

  return { weightKg, characteristics };
}

function extractVariants($: CheerioAPI): {
  variants: VariantSnapshot[];
  availabilityDefault?: string;
} {
  const pseMatch = $.html().match(/var\s+PSES\s*=\s*(\[[\s\S]*?\]);/);
  const attrMatch = $.html().match(/var\s+ATTRIBUTES\s*=\s*(\[[\s\S]*?\]);/);

  if (!pseMatch || !attrMatch) {
    return { variants: [], availabilityDefault: undefined };
  }

  let pses: ProcityPSE[];
  let attributes: ProcityAttribute[];
  try {
    pses = JSON.parse(pseMatch[1]);
    attributes = JSON.parse(attrMatch[1]);
  } catch {
    return { variants: [], availabilityDefault: undefined };
  }

  const attrIndex = new Map<number, ProcityAttribute>();
  attributes.forEach((a) => attrIndex.set(a.id, a));

  const variants: VariantSnapshot[] = pses.map((pse) => {
    const combo: Record<string, string> = {};
    let ral: string | undefined;
    for (const [attrId, valId] of Object.entries(pse.combination)) {
      const attr = attrIndex.get(Number(attrId));
      if (!attr) continue;
      const v = attr.values.find((val) => val.id === Number(valId));
      if (!v) continue;
      combo[attr.title] = v.label;
      if (attr.title === 'Couleur' && /^RAL\s*\d{4}/i.test(v.label)) ral = v.label;
    }
    return {
      variantRef: pse.ref,
      attributes: combo,
      ral,
      availability: pse.disponibility,
      weightKg: pse.weight > 0 ? pse.weight : undefined,
      imageFilenames: [],
    };
  });

  const deliveries = [...new Set(pses.map((p) => p.disponibility).filter(Boolean))];
  const availabilityDefault = deliveries.length === 1 ? deliveries[0] : undefined;

  return { variants, availabilityDefault };
}

function extractGalleryFilenames($: CheerioAPI, reference: string): string[] {
  const filenames = new Set<string>();
  $('img').each((_, el) => {
    const src =
      $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-splide-lazy') || '';
    if (!src) return;
    if (!/\.(jpe?g|png|webp)(?:\?|$)/i.test(src)) return;
    if (!src.includes(reference)) return;
    const filename = src.split('?')[0].split('/').pop();
    if (filename) filenames.add(filename);
  });
  return Array.from(filenames);
}

function extractTechSheet($: CheerioAPI): string | undefined {
  const link = $('a[href*=".pdf"]').first().attr('href');
  return link ? link.split('?')[0].split('/').pop() : undefined;
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&agrave;/g, 'à')
    .replace(/&icirc;/g, 'î')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&ucirc;/g, 'û')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&oelig;/g, 'œ');
}
