import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { parseTarifExcel, groupByProduct } from '../import/excel-parser';
import { ProcityFetcher, throttle } from './fetcher';
import { extractProductSnapshot } from './extractor';
import { downloadMedia, filenameFromUrl } from './media-downloader';
import { StateManager } from './state';
import type { ProductSnapshot } from './types';

const OUTPUT_DIR = join(process.cwd(), 'scripts/procity/scraper-output');
const SNAPSHOTS_DIR = join(OUTPUT_DIR, 'snapshots');
const IMAGES_DIR = join(OUTPUT_DIR, 'images');
const STATE_PATH = join(OUTPUT_DIR, 'state.json');
const EXCEL_PATH =
  '/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Fournisseurs/Procity/tarifprocityvialux2026-fr.v1.7-699.xlsx';

interface Stats {
  total: number;
  ok: number;
  skipped: number;
  skippedNoUrl: number;
  failed: number;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1], 10)
    : undefined;
  const force = args.includes('--force'); // ignore state, re-scrape tout
  const only = args.includes('--only')
    ? args[args.indexOf('--only') + 1]
    : undefined; // scraper une seule ref

  console.log('[scrape] loading Excel…');
  const rows = await parseTarifExcel(EXCEL_PATH);
  const products = groupByProduct(rows);
  console.log(`[scrape] ${products.length} produits uniques, ${rows.length} variantes`);

  // Dédupliquer par URL Procity (une URL regroupe souvent plusieurs refs SAPAL)
  const byUrl = new Map<string, { url: string; refs: string[] }>();
  for (const p of products) {
    if (!p.procityUrl) continue;
    if (!byUrl.has(p.procityUrl)) byUrl.set(p.procityUrl, { url: p.procityUrl, refs: [] });
    byUrl.get(p.procityUrl)!.refs.push(p.reference);
  }

  let targets = Array.from(byUrl.values());
  if (only) targets = targets.filter((t) => t.refs.includes(only));
  if (limit) targets = targets.slice(0, limit);

  console.log(`[scrape] ${targets.length} URLs uniques à traiter (couvrent ${targets.reduce((s, t) => s + t.refs.length, 0)} produits)`);

  const state = new StateManager(STATE_PATH);
  if (!force) await state.load();

  const fetcher = new ProcityFetcher();
  await fetcher.start();

  const stats: Stats = {
    total: targets.length,
    ok: 0,
    skipped: 0,
    skippedNoUrl: products.length - targets.length,
    failed: 0,
  };

  try {
    for (let i = 0; i < targets.length; i++) {
      const { url, refs } = targets[i];
      const progress = `[${i + 1}/${targets.length}]`;
      try {
        const fetched = await throttle(() => fetcher.fetchPage(url), 1500);
        const snapshot = extractProductSnapshot({ html: fetched.html, url });

        // Enrichir les variantes avec les images capturées lors des clics
        for (const variant of snapshot.variants) {
          const label = variant.attributes.Couleur || variant.attributes.couleur;
          if (!label) continue;
          const imgUrl = fetched.variantImages.get(label);
          if (imgUrl) {
            variant.imageFilenames = [filenameFromUrl(imgUrl)];
          }
        }

        const stateKey = `url:${url}`;
        if (!force && state.shouldSkip(stateKey, snapshot.contentHash)) {
          stats.skipped++;
          console.log(`${progress} [skip] ${snapshot.reference} (covers ${refs.length} refs, unchanged)`);
          continue;
        }

        // Sauvegarder le snapshot sous CHAQUE référence partageant cette URL.
        // On stocke aussi `mediaRef` = la ref canonique où vivent les images téléchargées.
        const primaryRef = refs[0];
        for (const ref of refs) {
          await saveSnapshot({ ...snapshot, reference: ref, mediaRef: primaryRef });
        }
        await downloadAllMedia(snapshot, fetched, refs);
        state.record(stateKey, snapshot.contentHash);
        await state.save();
        stats.ok++;
        console.log(`${progress} [ok] ${snapshot.reference} — ${snapshot.title} (covers ${refs.length} refs)`);
      } catch (err) {
        stats.failed++;
        const msg = (err as Error).message || String(err);
        console.error(`${progress} [fail] ${refs[0]} ${url}: ${msg}`);
      }
    }
  } finally {
    await fetcher.stop();
  }

  console.log('[scrape] done', stats);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, `run-${Date.now()}.stats.json`),
    JSON.stringify(stats, null, 2),
  );
}

async function saveSnapshot(snapshot: ProductSnapshot): Promise<void> {
  await mkdir(SNAPSHOTS_DIR, { recursive: true });
  await writeFile(
    join(SNAPSHOTS_DIR, `${snapshot.reference}.json`),
    JSON.stringify(snapshot, null, 2),
  );
}

async function downloadAllMedia(
  snapshot: ProductSnapshot,
  fetched: { imageLinks: string[]; variantImages: Map<string, string> },
  refs: string[],
): Promise<void> {
  // On télécharge les images UNE SEULE FOIS dans le dossier de la ref canonique,
  // puis on crée des copies pour les autres refs partageant l'URL (symlinks pas
  // supportés par tous les systèmes → on dupliquera si besoin lors de l'import).
  const primaryRef = refs[0];
  const dir = join(IMAGES_DIR, primaryRef);

  // Images variantes (prioritaires)
  for (const imgUrl of fetched.variantImages.values()) {
    try {
      await downloadMedia(imgUrl, dir, filenameFromUrl(imgUrl));
    } catch (err) {
      console.warn(`[media-warn] ${imgUrl}: ${(err as Error).message}`);
    }
  }

  // Autres images liées au produit (filtrer celles qui contiennent une des refs)
  const knownVariantUrls = new Set(fetched.variantImages.values());
  const related = fetched.imageLinks.filter(
    (u) => refs.some((r) => u.includes(r)) && !knownVariantUrls.has(u),
  );
  for (const imgUrl of related) {
    try {
      await downloadMedia(imgUrl, dir, filenameFromUrl(imgUrl));
    } catch (err) {
      console.warn(`[media-warn] ${imgUrl}: ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
