import ExcelJS from 'exceljs';
import { writeFileSync } from 'node:fs';

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile('/Users/pierrelaurent/Downloads/PIM Mobilier urbain FR - 22 avril 2026.xlsx');
const ws = wb.worksheets[0];

// Convertit le HTML <p>...</p> en texte brut multi-lignes
function htmlToPlain(s) {
  if (!s) return '';
  return String(s)
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<\/?p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, '')
    .replace(/ /g, ' ')
    .trim();
}

// Indexer la colonne E (Résumé) par référence parent (col A) — premier non-vide gagne
const summaries = new Map();
const headerRow = ws.getRow(1);
console.log('Headers:', [headerRow.getCell(1).value, headerRow.getCell(5).value, headerRow.getCell(6).value]);

let parsed = 0, withE = 0;
for (let r = 2; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  const refParent = row.getCell(1).value;
  const refDecl = row.getCell(2).value;
  const eVal = row.getCell(5).value;
  if (!refParent) continue;
  parsed++;
  const ref = String(refParent).trim();
  // On ne conserve que la première occurrence pour un parent (ligne A==B = ligne parent)
  if (!summaries.has(ref) && eVal) {
    const plain = htmlToPlain(typeof eVal === 'object' && eVal.richText ? eVal.richText.map(t => t.text).join('') : eVal);
    if (plain) {
      summaries.set(ref, plain);
      withE++;
    }
  }
}
console.log(`Parsed ${parsed} rows, ${summaries.size} parents with non-empty Résumé (E)`);
// Sample
const sampleKeys = [...summaries.keys()].slice(0, 3);
for (const k of sampleKeys) console.log(`  ${k}: ${summaries.get(k).slice(0, 120)}`);

// Émet un JSON pour la suite
writeFileSync('/tmp/pim_summaries.json', JSON.stringify([...summaries.entries()], null, 0));
console.log(`Written /tmp/pim_summaries.json (${summaries.size} entries)`);
