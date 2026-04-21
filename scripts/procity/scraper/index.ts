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

  let targets = products.filter((p) => p.procityUrl);
  if (only) targets = targets.filter((p) => p.reference === only);
  if (limit) targets = targets.slice(0, limit);

  console.log(`[scrape] ${targets.length} URLs à traiter`);

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
      const p = targets[i];
      const url = p.procityUrl!;
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

        if (!force && state.shouldSkip(snapshot.reference, snapshot.contentHash)) {
          stats.skipped++;
          console.log(`${progress} [skip] ${snapshot.reference} (unchanged)`);
          continue;
        }

        await saveSnapshot(snapshot);
        await downloadAllMedia(snapshot, fetched);
        state.record(snapshot.reference, snapshot.contentHash);
        await state.save();
        stats.ok++;
        console.log(`${progress} [ok] ${snapshot.reference} — ${snapshot.title}`);
      } catch (err) {
        stats.failed++;
        const msg = (err as Error).message || String(err);
        console.error(`${progress} [fail] ${p.reference} ${url}: ${msg}`);
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
): Promise<void> {
  const dir = join(IMAGES_DIR, snapshot.reference);

  // Images variantes (prioritaires)
  for (const imgUrl of fetched.variantImages.values()) {
    try {
      await downloadMedia(imgUrl, dir, filenameFromUrl(imgUrl));
    } catch (err) {
      console.warn(`[media-warn] ${imgUrl}: ${(err as Error).message}`);
    }
  }

  // Autres images liées au produit (filtrer celles qui contiennent la reference)
  const related = fetched.imageLinks.filter(
    (u) => u.includes(snapshot.reference) && !Array.from(fetched.variantImages.values()).includes(u),
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
