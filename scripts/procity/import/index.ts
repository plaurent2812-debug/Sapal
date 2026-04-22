import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { getProcitySupabaseClient } from '../shared/supabase-client';
import { parseTarifExcel, groupByProduct, type ProductFromExcel } from './excel-parser';
import { loadLocalPhotoIndex, matchImagesForReference } from './image-matcher';
import { uploadMedia, buildMediaPath } from './storage-uploader';
import { upsertProduct } from './db-writer';
import { makeComboKey } from './variant-keys';
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
  orphansOnly?: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  return {
    apply: args.includes('--apply'),
    limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : undefined,
    only: args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined,
    orphansOnly: args.includes('--orphans-only'),
  };
}

interface CanonicalGroup {
  canonicalRef: string;
  procityUrl: string | null;
  excelGroup: ProductFromExcel[];
}

/**
 * Regroupe les produits Excel par URL Procity :
 *  - URL présente → 1 groupe par URL, ref canonique = première ref (triée)
 *  - Pas d'URL → chaque produit reste isolé (1 groupe par ref)
 */
function groupByCanonical(all: ProductFromExcel[]): CanonicalGroup[] {
  const byUrl = new Map<string, ProductFromExcel[]>();
  const orphans: ProductFromExcel[] = [];

  for (const p of all) {
    if (p.procityUrl) {
      if (!byUrl.has(p.procityUrl)) byUrl.set(p.procityUrl, []);
      byUrl.get(p.procityUrl)!.push(p);
    } else {
      orphans.push(p);
    }
  }

  const groups: CanonicalGroup[] = [];
  for (const [url, list] of byUrl) {
    list.sort((a, b) => a.reference.localeCompare(b.reference));
    groups.push({ canonicalRef: list[0].reference, procityUrl: url, excelGroup: list });
  }
  for (const p of orphans) {
    groups.push({ canonicalRef: p.reference, procityUrl: null, excelGroup: [p] });
  }
  return groups;
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
  console.log(`[import] ${allProducts.length} refs Excel`);

  console.log('[import] indexing local HD photos…');
  const localPhotos = existsSync(LOCAL_HD_DIR) ? await loadLocalPhotoIndex(LOCAL_HD_DIR) : [];
  console.log(`[import] ${localPhotos.length} photos HD locales indexées`);

  const snapshotFiles = existsSync(SNAPSHOTS_DIR) ? await readdir(SNAPSHOTS_DIR) : [];
  const snapshotRefs = new Set(
    snapshotFiles.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')),
  );

  let groups = groupByCanonical(allProducts);
  console.log(`[import] ${groups.length} groupes canoniques après dédup par URL`);

  // Garder :
  //  - les groupes avec URL ET snapshot (importés avec photos scrapées)
  //  - les groupes SANS URL Procity (pas de scraping possible, on importe depuis Excel seul)
  //
  // On exclut seulement les groupes qui ont une URL mais pas encore de snapshot
  // (ils seront importés au prochain scrape).
  groups = groups.filter((g) => {
    if (!g.procityUrl) return true; // orphelin Excel : OK sans snapshot
    return g.excelGroup.some((p) => snapshotRefs.has(p.reference));
  });
  console.log(`[import] ${groups.length} groupes importables (avec snapshot OU sans URL)`);

  if (opts.orphansOnly) {
    groups = groups.filter((g) => !g.procityUrl);
    console.log(`[import] --orphans-only : ${groups.length} groupes sans URL Procity (Aires de jeux, Miroirs, Éq. sportifs, orphelins MU)`);
  }
  if (opts.only) {
    groups = groups.filter((g) => g.excelGroup.some((p) => p.reference === opts.only));
  }
  if (opts.limit) groups = groups.slice(0, opts.limit);

  console.log(`[import] ${groups.length} groupes à traiter`);

  if (!opts.apply) {
    console.log('[import] DRY-RUN: aucune écriture DB, aucun upload Storage');
    console.log('[import] groupes qui seraient traités:');
    groups.slice(0, 10).forEach((g) =>
      console.log(
        `  - canonical=${g.canonicalRef} (${g.excelGroup.length} refs) ${g.excelGroup[0].designationShort}`,
      ),
    );
    if (groups.length > 10) console.log(`  ... et ${groups.length - 10} autres`);
    return;
  }

  const stats = { ok: 0, failed: 0, inserted: 0, updated: 0, variants: 0 };

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const progress = `[${i + 1}/${groups.length}]`;
    try {
      // Le snapshot canonique est celui de la ref canonique (si dispo), sinon de la première ref dispo
      const snapshotRef =
        (snapshotRefs.has(group.canonicalRef) ? group.canonicalRef : undefined) ||
        group.excelGroup.find((p) => snapshotRefs.has(p.reference))?.reference;
      const snapshot = snapshotRef ? await loadSnapshot(snapshotRef) : null;

      const { galleryUrls, variantImageUrls } = await uploadGroupMedia(
        supabase,
        group,
        snapshot,
        localPhotos,
      );

      const { action, variantCount } = await upsertProduct(supabase, {
        excelGroup: group.excelGroup,
        snapshot,
        descriptionSapal: null,
        galleryUrls,
        variantImageUrls,
        techSheetUrl: null,
        supplierId: supplier.id,
      });

      stats.ok++;
      stats.variants += variantCount;
      if (action === 'insert') stats.inserted++;
      else stats.updated++;
      console.log(
        `${progress} [${action}] ${group.canonicalRef} ${group.excelGroup[0].designationShort} (${group.excelGroup.length} refs → ${variantCount} variantes)`,
      );
    } catch (err) {
      stats.failed++;
      console.error(`${progress} [fail] ${group.canonicalRef}: ${(err as Error).message}`);
    }
  }

  console.log('[import] done', stats);
}

async function loadSnapshot(reference: string): Promise<ProductSnapshot | null> {
  const path = join(SNAPSHOTS_DIR, `${reference}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf-8'));
}

/**
 * Upload médias pour un groupe canonique.
 *
 * - Galerie : photos HD locales de toutes les refs du groupe + toutes images scrapées.
 * - variantImageUrls : map coloris → URL (on prend n'importe quelle combinaison ayant
 *   ce coloris ; la longueur/crosse/structure n'influencent pas la photo côté Procity
 *   pour la plupart des produits — c'est la couleur qui change le rendu).
 *   Si on veut être plus fin, on pourra utiliser aussi (longueur, structure) dans la clé.
 */
async function uploadGroupMedia(
  supabase: ReturnType<typeof getProcitySupabaseClient>,
  group: CanonicalGroup,
  snapshot: ProductSnapshot | null,
  localPhotos: string[],
): Promise<{ galleryUrls: string[]; variantImageUrls: Record<string, string> }> {
  const galleryUrls: string[] = [];
  const variantImageUrls: Record<string, string> = {};
  const canonicalRef = group.canonicalRef;

  // 1) Photos HD locales : toutes les refs du groupe
  for (const excel of group.excelGroup) {
    const hdMatches = matchImagesForReference(excel.reference, localPhotos);
    for (const filename of hdMatches) {
      try {
        const url = await uploadMedia(
          supabase,
          join(LOCAL_HD_DIR, filename),
          buildMediaPath('procity', canonicalRef, 'gallery', filename),
        );
        if (!galleryUrls.includes(url)) galleryUrls.push(url);
      } catch (err) {
        console.warn(`[hd-warn] ${filename}: ${(err as Error).message}`);
      }
    }
  }

  // 2) Images scrapées
  if (snapshot) {
    const mediaDirRef = snapshot.mediaRef || snapshot.reference;
    const scraperDir = join(IMAGES_DIR, mediaDirRef);
    if (existsSync(scraperDir)) {
      const scraperFiles = await readdir(scraperDir);

      for (const f of scraperFiles) {
        try {
          const url = await uploadMedia(
            supabase,
            join(scraperDir, f),
            buildMediaPath('procity', canonicalRef, 'gallery', f),
          );
          if (!galleryUrls.includes(url)) galleryUrls.push(url);
        } catch (err) {
          console.warn(`[scrap-warn] ${f}: ${(err as Error).message}`);
        }
      }

      // Primary image par COMBINAISON (couleur × structure × longueur × crosse).
      // On dédupe sur le nom de fichier d'image pour ne pas ré-uploader la même photo
      // (le scraper en télécharge souvent plusieurs copies identiques).
      // La clé est normalisée via `makeComboKey` pour matcher ensuite côté db-writer.
      const byCombo = new Map<string, string>();
      const uploadedByFilename = new Map<string, string>();
      for (const variant of snapshot.variants) {
        const color = variant.attributes.Couleur || variant.attributes.couleur;
        if (!color) continue;
        const firstImg = variant.imageFilenames[0];
        if (!firstImg) continue;
        const localPath = join(scraperDir, firstImg);
        if (!existsSync(localPath)) continue;

        const normColor = normalizeColorKey(color);
        const structure = variant.attributes.Structure || '';
        const longueur = variant.attributes.Longueur || variant.attributes['Longueur (mm)'] || '';
        const crosse = variant.attributes['Structure autre'] || variant.attributes.Crosse || '';
        const comboKey = makeComboKey(normColor, structure, longueur, crosse);
        if (byCombo.has(comboKey)) continue;

        // Upload 1 fois par fichier unique
        let url = uploadedByFilename.get(firstImg);
        if (!url) {
          try {
            url = await uploadMedia(
              supabase,
              localPath,
              buildMediaPath('procity', canonicalRef, 'variants', firstImg),
            );
            uploadedByFilename.set(firstImg, url);
          } catch (err) {
            console.warn(`[var-img-warn] ${firstImg}: ${(err as Error).message}`);
            continue;
          }
        }
        byCombo.set(comboKey, url);
      }

      // Expose la map pour chaque ref Excel : clé précise + clé par couleur uniquement
      // (fallback pour les produits sans axes autres que couleur).
      for (const excel of group.excelGroup) {
        for (const ev of excel.variants) {
          for (const [comboKey, url] of byCombo) {
            variantImageUrls[`${ev.reference}__${comboKey}`] = url;
          }
        }
      }

      // OVERRIDE par nom de fichier : la convention Procity `<hash>-<refExcel>_<colorCode>_<n>.ext`
      // est plus fiable que le mapping par clic du scraper, qui partage parfois la même
      // image entre 2 combinaisons (ex: Simple croix 1500 et Avec rosace 1500 pointent
      // sur la même photo Procity, alors que les vraies photos ref-spécifiques existent
      // sur disque). On fait un pass complet : pour CHAQUE (refExcel, color), si un
      // fichier local match le pattern, il prime sur ce que byCombo a stocké.
      const colorsInSnapshot = new Set<string>();
      if (snapshot) {
        for (const v of snapshot.variants) {
          const c = v.attributes.Couleur || v.attributes.couleur;
          if (c) colorsInSnapshot.add(normalizeColorKey(c));
        }
      }
      // Priorité de matching par ref Excel, dans cet ordre :
      //  1) Fichier exact `<hash>-<refExcel>_<color>_*.ext` (photo Procity pour
      //     cette ref exacte) si le scraper l'a téléchargée.
      //  2) Fichier d'une autre ref Excel du MÊME GROUPE qui partage la STRUCTURE
      //     (même designationFull "Simple croix") — on tolère un mismatch longueur.
      //     Évite d'afficher une photo "Avec rosace" pour une "Simple croix".
      //     Note : Procity a souvent une photo exacte par (ref × color) mais le hash
      //     de fichier est différent pour chaque couleur et caché derrière leur JS,
      //     impossible à deviner côté client. Le fallback structure est la meilleure
      //     approximation.
      //  3) Laisser vide (le db-writer tombera sur la galerie).
      const refToStructure = new Map<string, string>();
      for (const excel of group.excelGroup) {
        for (const ev of excel.variants) {
          const structNorm = normalizeKeyTokenLocal(extractStructureFromExcel(ev));
          if (structNorm) refToStructure.set(ev.reference, structNorm);
        }
      }

      for (const excel of group.excelGroup) {
        for (const ev of excel.variants) {
          const excelRef = ev.reference;
          const evStructure = refToStructure.get(excelRef) || '';
          for (const normColor of colorsInSnapshot) {
            // 1) Match exact par refExcel + color (fichier local existant)
            let candidate = scraperFiles.find((f) =>
              f.includes(`_${excelRef}_${normColor}_`) || f.includes(`-${excelRef}_${normColor}_`) ||
              f.includes(`_${excelRef}_${normColor.toLowerCase()}_`) || f.includes(`-${excelRef}_${normColor.toLowerCase()}_`),
            );
            let localCandidatePath = candidate ? join(scraperDir, candidate) : '';

            // 2) Sinon : même structure dans le groupe, couleur identique (autre ref Excel)
            if (!candidate) {
              for (const [otherRef, otherStructure] of refToStructure) {
                if (otherRef === excelRef) continue;
                if (otherStructure !== evStructure) continue;
                candidate = scraperFiles.find((f) =>
                  f.includes(`_${otherRef}_${normColor}_`) || f.includes(`-${otherRef}_${normColor}_`) ||
                  f.includes(`_${otherRef}_${normColor.toLowerCase()}_`) || f.includes(`-${otherRef}_${normColor.toLowerCase()}_`),
                );
                if (candidate) {
                  localCandidatePath = join(scraperDir, candidate);
                  break;
                }
              }
            }
            if (!candidate || !existsSync(localCandidatePath)) continue;

            let url = uploadedByFilename.get(candidate);
            if (!url) {
              try {
                url = await uploadMedia(
                  supabase,
                  localCandidatePath,
                  buildMediaPath('procity', canonicalRef, 'variants', candidate),
                );
                uploadedByFilename.set(candidate, url);
              } catch (err) {
                console.warn(`[var-img-fallback-warn] ${candidate}: ${(err as Error).message}`);
                continue;
              }
            }
            variantImageUrls[`${excelRef}__${normColor}`] = url;
          }
        }
      }
    }
  }

  return { galleryUrls, variantImageUrls };
}

/** Extrait la structure depuis le suffixe de designationFull Excel. */
function extractStructureFromExcel(ev: {
  designationFull?: string;
  designationShort?: string;
}): string {
  const full = (ev.designationFull || '').toUpperCase();
  const short = (ev.designationShort || '').toUpperCase();
  const suffix = full.replace(short, '').trim();
  if (!suffix) return '';
  if (/AVEC\s+ROSACE/.test(suffix)) return 'Avec rosace';
  if (/SIMPLE\s+CROIX/.test(suffix)) return 'Simple croix';
  if (/DOUBLE\s+CROIX/.test(suffix)) return 'Double croix';
  if (/GRILLAG/.test(suffix)) return 'Grillagée';
  return suffix;
}

function normalizeKeyTokenLocal(s: string | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/** Même normalisation que dans db-writer.ts pour retire "RAL" des codes à 4 chiffres. */
function normalizeColorKey(raw: string): string {
  const trimmed = raw.trim();
  const ral = trimmed.match(/^RAL\s*(\d{4})$/i);
  if (ral) return ral[1];
  return trimmed;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
