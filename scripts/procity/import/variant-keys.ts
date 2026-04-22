/**
 * Clés stables pour associer les images scrapées aux variantes Excel.
 * Les mêmes normalisations doivent être utilisées côté upload (index.ts) et
 * côté lookup (db-writer.ts) pour que les URLs se retrouvent.
 */

function normalizeKeyToken(s: string | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/** Clé de combinaison : color|structure|longueur|crosse, tokens normalisés. */
export function makeComboKey(color: string, structure: string, longueur: string, crosse: string): string {
  return [
    normalizeKeyToken(color),
    normalizeKeyToken(structure),
    normalizeKeyToken(longueur),
    normalizeKeyToken(crosse),
  ].join('|');
}
