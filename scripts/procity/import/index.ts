import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getProcitySupabaseClient } from '../shared/supabase-client';
import { parseTarifExcel, groupByProduct, type ProductFromExcel } from './excel-parser';
import { loadLocalPhotoIndex, matchImagesForReference } from './image-matcher';
import { uploadMedia, buildMediaPath } from './storage-uploader';
import { upsertProduct } from './db-writer';
import type { ProductSnapshot } from '../scraper/types';

const SCRAPER_OUTPUT = join(process.cwd(), 'scripts/procity/scraper-output');
const SNAPSHOTS_DIR = join(SCRAPER_OUTPUT, 'snapshots');
const IMAGES_DIR = join(SCRAPER_OUTPUT, 'images');
const LOCAL_HD_DIR =
  '/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Fournisseurs/Procity/Photos - 300 dpi - PROCITY FR 2026 2';
const EXCEL_PATH =
  '/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Fournisseurs/Procity/tarifprocityvialux2026-fr.v1.7-699.xlsx';

interface Options {
  apply: boolean;
  limit?: number;
  only?: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  return {
    apply: args.includes('--apply'),
    limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : undefined,
    only: args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined,
  };
}

async function main() {
  const opts = parseArgs();
  const mode = opts.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`[import] mode=${mode}${opts.limit ? ` limit=${opts.limit}` : ''}${opts.only ? ` only=${opts.only}` : ''}`);

  const supabase = getProcitySupabaseClient();
  const { data: supplier, error: supErr } = await supabase
    .from('suppliers').select('id').eq('slug', 'procity').single();
  if (supErr || !supplier) throw new Error(`Supplier procity not found: ${supErr?.message}`);

  console.log('[import] loading Excel…');
  const rows = await parseTarifExcel(EXCEL_PATH);
  const allProducts = groupByProduct(rows);

  console.log('[import] indexing local HD photos…');
  const localPhotos = existsSync(LOCAL_HD_DIR) ? await loadLocalPhotoIndex(LOCAL_HD_DIR) : [];
  console.log(`[import] ${localPhotos.length} photos HD locales indexées`);

  // Filtre : on ne traite que les produits pour lesquels on a un snapshot disponible
  const snapshotFiles = existsSync(SNAPSHOTS_DIR) ? await readdir(SNAPSHOTS_DIR) : [];
  const snapshotRefs = new Set(
    snapshotFiles.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')),
  );

  let targets = allProducts.filter((p) => snapshotRefs.has(p.reference));
  if (opts.only) targets = targets.filter((p) => p.reference === opts.only);
  if (opts.limit) targets = targets.slice(0, opts.limit);

  console.log(`[import] ${targets.length} produits à traiter (${snapshotRefs.size} snapshots dispo au total)`);

  if (!opts.apply) {
    console.log('[import] DRY-RUN: aucune écriture DB, aucun upload Storage, aucun appel LLM');
    console.log('[import] produits qui seraient traités:');
    targets.slice(0, 10).forEach((p) => console.log(`  - ${p.reference} ${p.designationShort}`));
    if (targets.length > 10) console.log(`  ... et ${targets.length - 10} autres`);
    return;
  }

  const stats = { ok: 0, failed: 0, inserted: 0, updated: 0 };

  for (let i = 0; i < targets.length; i++) {
    const excel = targets[i];
    const progress = `[${i + 1}/${targets.length}]`;
    try {
      const snapshot = await loadSnapshot(excel.reference);
      const { galleryUrls, variantImageUrls } = await uploadProductMedia(
        supabase, excel, snapshot, localPhotos,
      );

      const { action } = await upsertProduct(supabase, {
        excel,
        snapshot,
        descriptionSapal: null,   // descriptions désactivées — on n'affiche plus de texte produit
        galleryUrls,
        variantImageUrls,
        techSheetUrl: null,        // Procity bloque les PDFs — on les ajoutera à la main plus tard
        supplierId: supplier.id,
      });

      stats.ok++;
      if (action === 'insert') stats.inserted++;
      else stats.updated++;
      console.log(`${progress} [${action}] ${excel.reference} ${excel.designationShort}`);
    } catch (err) {
      stats.failed++;
      console.error(`${progress} [fail] ${excel.reference}: ${(err as Error).message}`);
    }
  }

  console.log('[import] done', stats);
}

async function loadSnapshot(reference: string): Promise<ProductSnapshot | null> {
  const path = join(SNAPSHOTS_DIR, `${reference}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function uploadProductMedia(
  supabase: ReturnType<typeof getProcitySupabaseClient>,
  excel: ProductFromExcel,
  snapshot: ProductSnapshot | null,
  localPhotos: string[],
): Promise<{ galleryUrls: string[]; variantImageUrls: Record<string, string> }> {
  const ref = excel.reference;
  const galleryUrls: string[] = [];
  const variantImageUrls: Record<string, string> = {};

  // 1. Photos HD locales (prioritaires)
  const hdMatches = matchImagesForReference(ref, localPhotos);
  for (const filename of hdMatches) {
    try {
      const url = await uploadMedia(
        supabase,
        join(LOCAL_HD_DIR, filename),
        buildMediaPath('procity', ref, 'gallery', filename),
      );
      galleryUrls.push(url);
    } catch (err) {
      console.warn(`[hd-warn] ${filename}: ${(err as Error).message}`);
    }
  }

  // 2. Images scrapées : gallery supplémentaire + primary par variante
  // Les images peuvent être stockées sous la ref canonique (mediaRef) quand plusieurs
  // refs SAPAL partagent la même URL Procity.
  if (snapshot) {
    const mediaDirRef = snapshot.mediaRef || ref;
    const scraperDir = join(IMAGES_DIR, mediaDirRef);
    if (existsSync(scraperDir)) {
      const scraperFiles = await readdir(scraperDir);

      // Upload toutes les images scrapées dans la galerie (complément aux HD)
      for (const f of scraperFiles) {
        try {
          const url = await uploadMedia(
            supabase,
            join(scraperDir, f),
            buildMediaPath('procity', ref, 'gallery', f),
          );
          if (!galleryUrls.includes(url)) galleryUrls.push(url);
        } catch (err) {
          console.warn(`[scrap-warn] ${f}: ${(err as Error).message}`);
        }
      }

      // Primary image par variante
      for (const variant of snapshot.variants) {
        const firstImg = variant.imageFilenames[0];
        if (!firstImg) continue;
        const localPath = join(scraperDir, firstImg);
        if (!existsSync(localPath)) continue;
        try {
          const url = await uploadMedia(
            supabase,
            localPath,
            buildMediaPath('procity', ref, 'variants', `${variant.variantRef}_${firstImg}`),
          );
          variantImageUrls[variant.variantRef] = url;
        } catch (err) {
          console.warn(`[var-img-warn] ${firstImg}: ${(err as Error).message}`);
        }
      }
    }
  }

  return { galleryUrls, variantImageUrls };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
