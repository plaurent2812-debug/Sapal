import ExcelJS from 'exceljs';

/**
 * Parser Excel tarif Procity 2026.
 *
 * Structure du fichier : plusieurs feuilles (MOBILIER URBAIN, AIRES DE JEUX, ÉQUIPEMENTS
 * SPORTIFS, MIROIRS, Hors standard, etc.) avec l'en-tête à la ligne 5 et les données à
 * partir de la ligne 6. Chaque ligne correspond à UNE variante d'un produit ; plusieurs
 * lignes peuvent partager la même référence produit (une variante standard + une par couleur).
 *
 * On ne traite que les feuilles du catalogue principal (pas CGV, Pièces détachées, Accueil…).
 */

export interface TarifVariantRow {
  reference: string;                  // référence produit (peut être répétée entre lignes)
  rowIndex: number;                   // numéro de ligne Excel (pour debug)
  sheet: string;                      // nom de la feuille source
  category?: string;                  // ex: "AMÉNAGEMENT DE LA RUE"
  productType?: string;               // ex: "BARRIÈRES DE VILLE"
  designationShort?: string;          // ex: "BARRIÈRE MAIN COURANTE LISBONNE"
  designationFull?: string;           // ex: "BARRIÈRE MAIN COURANTE LISBONNE SIMPLE CROIX"
  finition?: string;
  vitrage?: string;
  pommeau?: string;
  dimensions?: string;
  weightKg?: number;
  pricePublicHt?: number;
  priceNetHt?: number;                // prix revendeur (colonne formule PRIX NETS)
  coloris?: string;                   // ex: "Standard", "3004", "6005", "Gris Procity"
  colorisStock?: string;
  delai?: string;                     // ex: "3 semaines", "Disponible sur stock - expédition sous 2 à 5 jours maximum"
  page?: number;
  procityUrl?: string;
  marque?: string;                    // "PROCITY" / "VIALUX"
  is3D?: boolean;
  isNouveaute?: string;
}

export type UniverseSlug = 'mobilier-urbain' | 'aires-de-jeux' | 'equipements-sportifs' | 'miroirs';

export interface ProductFromExcel {
  reference: string;
  procityUrl?: string;
  universe: UniverseSlug;
  category?: string;
  productType?: string;
  designationShort?: string;
  designationFull?: string;
  variants: TarifVariantRow[];
}

interface SheetConfig {
  name: string;
  headerRow: number;
  universe: UniverseSlug;
  cols: {
    reference: number;
    nouveautes?: number;
    category: number;
    productType: number;
    designationShort: number;
    designationFull: number;
    finition?: number;
    vitrage?: number;
    pommeau?: number;
    dimensions: number;
    poids: number;
    pricePublic: number;
    priceNet: number;
    coloris: number;
    colorisStock?: number;
    delai: number;
    page?: number;
    url: number;
    marque?: number;
    is3D?: number;
  };
}

/**
 * Configs statiques — on connaît la structure exacte de chaque feuille grâce à l'inspection
 * manuelle. Si Procity change son format, ces configs sont le seul endroit à adapter.
 */
const SHEET_CONFIGS: SheetConfig[] = [
  {
    name: 'MOBILIER URBAIN',
    headerRow: 5,
    universe: 'mobilier-urbain',
    cols: {
      reference: 1,
      nouveautes: 2,
      category: 3,
      productType: 4,
      designationShort: 5,
      designationFull: 6,
      finition: 7,
      vitrage: 8,
      pommeau: 9,
      dimensions: 10,
      poids: 11,
      pricePublic: 12,
      priceNet: 13,
      coloris: 14,
      colorisStock: 15,
      delai: 16,
      page: 17,
      url: 18,
      marque: 19,
      is3D: 21,
    },
  },
  {
    name: 'AIRES DE JEUX',
    headerRow: 5,
    universe: 'aires-de-jeux',
    cols: {
      reference: 1,
      nouveautes: 2,
      category: 3,
      productType: 4,
      designationShort: 5,
      designationFull: 6,
      finition: 7,
      dimensions: 8,
      poids: 9,
      pricePublic: 10,
      priceNet: 11,
      coloris: 12,
      delai: 13,
      page: 14,
      url: 15,
      marque: 16,
    },
  },
  {
    name: 'ÉQUIPEMENTS SPORTIFS',
    headerRow: 5,
    universe: 'equipements-sportifs',
    cols: {
      reference: 1,
      nouveautes: 2,
      category: 3,
      productType: 4,
      designationShort: 5,
      designationFull: 6,
      finition: 7,
      dimensions: 8,
      poids: 9,
      pricePublic: 10,
      priceNet: 11,
      coloris: 12,
      delai: 13,
      page: 14,
      url: 15,
      marque: 16,
    },
  },
  {
    // Onglet MIROIRS : l'en-tête est différente (ref SPL en col 1, ref MI en col 2,
    // category en 4, type en 5, designation en 6/7). Les dimensions sont décomposées
    // (Optique col 9 + Cadre col 10) mais on prendra "Optique" comme dimension.
    name: 'MIROIRS',
    headerRow: 5,
    universe: 'miroirs',
    cols: {
      reference: 1,
      nouveautes: 3,
      category: 4,
      productType: 5,
      designationShort: 6,
      designationFull: 7,
      finition: 8, // "QUALITE" (Polymir, Stainless, etc.)
      dimensions: 9, // "DIMENSIONS OPTIQUE"
      poids: 11,
      pricePublic: 12,
      priceNet: 13,
      coloris: 14,
      delai: 15,
      page: 16,
      url: 17,
      marque: 18,
    },
  },
];

export async function parseTarifExcel(filePath: string): Promise<TarifVariantRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const allRows: TarifVariantRow[] = [];

  for (const cfg of SHEET_CONFIGS) {
    const sheet = wb.getWorksheet(cfg.name);
    if (!sheet) {
      console.warn(`[excel] sheet "${cfg.name}" not found, skipping`);
      continue;
    }

    const startRow = cfg.headerRow + 1;
    for (let r = startRow; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const ref = cellString(row.getCell(cfg.cols.reference).value);
      if (!ref || !/^\d{4,7}$/.test(ref.trim())) continue;

      const urlRaw = cellString(row.getCell(cfg.cols.url).value);
      const url = urlRaw && urlRaw !== '-' && urlRaw.includes('procity.eu') ? urlRaw : '';

      allRows.push({
        reference: ref.trim(),
        rowIndex: r,
        sheet: cfg.name,
        category: cellString(row.getCell(cfg.cols.category).value) || undefined,
        productType: cellString(row.getCell(cfg.cols.productType).value) || undefined,
        designationShort: cellString(row.getCell(cfg.cols.designationShort).value) || undefined,
        designationFull: cellString(row.getCell(cfg.cols.designationFull).value) || undefined,
        finition: cfg.cols.finition ? cellString(row.getCell(cfg.cols.finition).value) || undefined : undefined,
        vitrage: cfg.cols.vitrage ? cellString(row.getCell(cfg.cols.vitrage).value) || undefined : undefined,
        pommeau: cfg.cols.pommeau ? cellString(row.getCell(cfg.cols.pommeau).value) || undefined : undefined,
        dimensions: cellString(row.getCell(cfg.cols.dimensions).value) || undefined,
        weightKg: cellNumber(row.getCell(cfg.cols.poids).value),
        pricePublicHt: cellNumber(row.getCell(cfg.cols.pricePublic).value),
        priceNetHt: cellNumber(row.getCell(cfg.cols.priceNet).value),
        coloris: cellString(row.getCell(cfg.cols.coloris).value) || undefined,
        colorisStock: cfg.cols.colorisStock ? cellString(row.getCell(cfg.cols.colorisStock).value) || undefined : undefined,
        delai: cellString(row.getCell(cfg.cols.delai).value) || undefined,
        page: cfg.cols.page ? cellNumber(row.getCell(cfg.cols.page).value) : undefined,
        procityUrl: url || undefined,
        marque: cfg.cols.marque ? cellString(row.getCell(cfg.cols.marque).value) || undefined : undefined,
        is3D: cfg.cols.is3D ? cellString(row.getCell(cfg.cols.is3D).value)?.toLowerCase() === 'oui' : undefined,
        isNouveaute: cfg.cols.nouveautes ? cellString(row.getCell(cfg.cols.nouveautes).value) || undefined : undefined,
      });
    }
  }

  return allRows;
}

/**
 * Regroupe les variantes par référence produit en gardant l'ordre d'apparition.
 * Une ligne "Standard" (coloris=Standard ou similaire) est souvent la première — on garde son URL
 * comme canonical pour le produit.
 */
export function groupByProduct(rows: TarifVariantRow[]): ProductFromExcel[] {
  const map = new Map<string, ProductFromExcel>();

  for (const row of rows) {
    let prod = map.get(row.reference);
    if (!prod) {
      prod = {
        reference: row.reference,
        procityUrl: row.procityUrl,
        universe: sheetNameToUniverse(row.sheet),
        category: row.category,
        productType: row.productType,
        designationShort: row.designationShort,
        designationFull: row.designationFull,
        variants: [],
      };
      map.set(row.reference, prod);
    }
    if (!prod.procityUrl && row.procityUrl) prod.procityUrl = row.procityUrl;
    if (!prod.category && row.category) prod.category = row.category;
    if (!prod.productType && row.productType) prod.productType = row.productType;
    if (!prod.designationShort && row.designationShort) prod.designationShort = row.designationShort;
    if (!prod.designationFull && row.designationFull) prod.designationFull = row.designationFull;
    prod.variants.push(row);
  }

  return Array.from(map.values());
}

function sheetNameToUniverse(name: string): UniverseSlug {
  if (name === 'AIRES DE JEUX') return 'aires-de-jeux';
  if (name === 'ÉQUIPEMENTS SPORTIFS') return 'equipements-sportifs';
  if (name === 'MIROIRS') return 'miroirs';
  return 'mobilier-urbain';
}

function cellString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object') {
    const obj = v as { text?: string; richText?: Array<{ text: string }>; result?: unknown; hyperlink?: string };
    if (obj.hyperlink) return String(obj.hyperlink);
    if (obj.text) return String(obj.text).trim();
    if (obj.richText) return obj.richText.map((t) => t.text).join('').trim();
    if (obj.result !== undefined && obj.result !== null) return String(obj.result).trim();
  }
  return String(v).trim();
}

function cellNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    const obj = v as { result?: unknown };
    if (typeof obj.result === 'number') return obj.result;
  }
  const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return isNaN(n) ? undefined : n;
}
