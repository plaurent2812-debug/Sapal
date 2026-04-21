/**
 * Correctif ciblé : met à jour la colonne `poids` des variantes product_variants
 * en utilisant la valeur `weight` exposée dans la variable JS PSES de chaque fiche Procity.
 *
 * Lit directement le HTML source Procity (curl) — pas besoin de Playwright ni d'images.
 * Strategie :
 *   1. Lire les snapshots locaux pour obtenir la liste des URLs Procity + refs.
 *   2. Dédupliquer par URL.
 *   3. Pour chaque URL, curl le HTML, extraire PSES, mapper variantRef -> weight.
 *   4. UPDATE en DB : product_variants.poids = <weight> kg WHERE reference = <variantRef>
 *      et product_id correspondant à la ref Excel.
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { getProcitySupabaseClient } from './shared/supabase-client';
import type { ProductSnapshot } from './scraper/types';

const SNAPSHOTS_DIR = join(process.cwd(), 'scripts/procity/scraper-output/snapshots');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) SAPAL-Mirror/1.0';

interface ProcityPSE {
  ref: string;
  weight: number;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  console.log(`[fix-weights] mode=${dryRun ? 'DRY-RUN' : 'APPLY'}`);

  const supabase = getProcitySupabaseClient();

  // 1. Charger tous les snapshots et dédupliquer par URL
  const files = await readdir(SNAPSHOTS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));
  console.log(`[fix-weights] ${jsonFiles.length} snapshots à examiner`);

  const urlToRefs = new Map<string, Set<string>>();
  for (const f of jsonFiles) {
    const raw = await readFile(join(SNAPSHOTS_DIR, f), 'utf-8');
    const snapshot: ProductSnapshot = JSON.parse(raw);
    if (!snapshot.procityUrl) continue;
    if (!urlToRefs.has(snapshot.procityUrl)) urlToRefs.set(snapshot.procityUrl, new Set());
    urlToRefs.get(snapshot.procityUrl)!.add(snapshot.reference);
  }
  console.log(`[fix-weights] ${urlToRefs.size} URLs uniques à fetch`);

  let totalUpdated = 0;
  let totalFailed = 0;
  let urlIndex = 0;

  for (const [url, refs] of urlToRefs) {
    urlIndex++;
    const progress = `[${urlIndex}/${urlToRefs.size}]`;

    try {
      const html = await fetchHtml(url);
      const pses = extractPses(html);
      if (pses.length === 0) {
        console.warn(`${progress} [skip] ${url}: no PSES found`);
        continue;
      }

      // Récupérer les product_id SAPAL correspondant aux refs Excel associées à cette URL.
      // Les PSES Procity peuvent contenir des variantes dont la ref de base n'est PAS dans
      // l'Excel (ex: 599777 pour Modulo sur platines, alors que seul 529777 est listé).
      // On met donc à jour sur l'ensemble des product_id partageant cette URL.
      const { data: productRows } = await supabase
        .from('products')
        .select('id')
        .in('reference', Array.from(refs));
      const productIds = (productRows ?? []).map((p: { id: string }) => p.id);

      if (productIds.length === 0) {
        console.warn(`${progress} [skip] ${url}: no product_id found in DB`);
        continue;
      }

      for (const pse of pses) {
        if (!pse.weight || pse.weight <= 0) continue;
        const poidsStr = `${pse.weight} kg`;

        if (dryRun) {
          console.log(`  ${progress} would update ${pse.ref} -> ${poidsStr}`);
          continue;
        }

        const { error, count } = await supabase
          .from('product_variants')
          .update({ poids: poidsStr }, { count: 'exact' })
          .eq('reference', pse.ref)
          .in('product_id', productIds);

        if (error) {
          console.error(`  ${progress} [fail] ${pse.ref}: ${error.message}`);
          totalFailed++;
        } else if (count && count > 0) {
          totalUpdated += count;
        }
      }

      console.log(`${progress} ${url.split('/').pop()} — ${pses.length} variants processed`);
    } catch (err) {
      console.error(`${progress} [fail] ${url}: ${(err as Error).message}`);
      totalFailed++;
    }
  }

  console.log(`[fix-weights] done. Updated rows: ${totalUpdated}, failed URLs/variants: ${totalFailed}`);
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function extractPses(html: string): ProcityPSE[] {
  const match = html.match(/var\s+PSES\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]) as ProcityPSE[];
  } catch {
    return [];
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
