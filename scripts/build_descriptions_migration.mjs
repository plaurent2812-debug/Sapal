import { readFileSync, writeFileSync } from 'node:fs';
const entries = JSON.parse(readFileSync('/tmp/pim_summaries.json', 'utf8'));

// Échappement Postgres pour les apostrophes
function esc(s) { return String(s).replace(/'/g, "''"); }

const lines = [];
lines.push(`-- Aligne products.description sur la colonne E (\"Résumé\") du PIM Mobilier urbain FR — 22 avril 2026.`);
lines.push(`-- Avant : 375 produits Procity affichaient un texte long de 4000-5000 char (issu d'un ancien scrape).`);
lines.push(`-- Après : courte description marketing du PIM Procity (HTML <p> nettoyé en texte brut).`);
lines.push(`-- N'écrase que les enregistrements dont l'id matche un parent du PIM (clé Réf produit = col A).`);
lines.push(``);

// Découpe en chunks de 200 pour rester sous les limites SQL Editor
const CHUNK = 200;
for (let i = 0; i < entries.length; i += CHUNK) {
  const slice = entries.slice(i, i + CHUNK);
  lines.push(`-- Chunk ${Math.floor(i/CHUNK)+1}/${Math.ceil(entries.length/CHUNK)} (${slice.length} rows)`);
  lines.push(`UPDATE products AS p SET description = v.summary`);
  lines.push(`FROM (VALUES`);
  const valuesRows = slice.map(([id, summary]) => `  ('${esc(id)}', '${esc(summary)}')`).join(',\n');
  lines.push(valuesRows);
  lines.push(`) AS v(id, summary)`);
  lines.push(`WHERE p.id = v.id;`);
  lines.push(``);
}

const sql = lines.join('\n');
writeFileSync('supabase/migrations/20260427c_pim_descriptions_from_resume.sql', sql);
console.log(`Written supabase/migrations/20260427c_pim_descriptions_from_resume.sql (${entries.length} updates, ${Math.ceil(entries.length/CHUNK)} chunks)`);
