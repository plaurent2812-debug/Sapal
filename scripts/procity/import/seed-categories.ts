/**
 * Seed la hiérarchie Procity (3 niveaux) dans la table `categories`.
 *
 * Convention d'identifiants :
 *   univers  : "proc-<universe>"                       ex: "proc-mobilier-urbain"
 *   category : "proc-<universe>-<category>"            ex: "proc-mobilier-urbain-amenagement-de-la-rue"
 *   type     : "proc-<universe>-<category>-<type>"    ex: "...-amenagement-de-la-rue-barrieres-de-ville"
 *
 * On utilise des IDs text (cohérent avec le schéma) pour éviter les collisions
 * avec les catégories SAPAL historiques à id numériques ("1", "10", "22"…).
 *
 * Idempotent : on ON CONFLICT DO UPDATE pour pouvoir re-run.
 */
import { parseTarifExcel } from './excel-parser';
import { getProcitySupabaseClient } from '../shared/supabase-client';
import type { UniverseSlug } from './excel-parser';

const UNIVERSE_NAMES: Record<UniverseSlug, string> = {
  'mobilier-urbain': 'Mobilier urbain',
  'aires-de-jeux': 'Aires de jeux',
  'equipements-sportifs': 'Équipements sportifs',
  miroirs: 'Miroirs',
};

const UNIVERSE_ORDER: UniverseSlug[] = [
  'mobilier-urbain',
  'aires-de-jeux',
  'equipements-sportifs',
  'miroirs',
];

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'et')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

/**
 * Sentence case à la française (style Procity) : seul le premier mot capitalisé,
 * le reste en minuscules sauf acronymes connus (TP, AGE, PSE…) et noms propres.
 * Règles :
 *  - Premier mot → capitalisé
 *  - Acronymes connus → MAJUSCULES
 *  - Noms propres/marques → Capitalisés (Conviviale, Province, Kub, Milan, Venise, Turin, Voûte, Modulo, Heritage, Lisbonne, Héritage)
 *  - Tout le reste → minuscules
 */
function titleCase(rawInput: string): string {
  // Nettoyage : retirer le point final sur "KUB." et normaliser virgules
  const s = rawInput.replace(/\.$/, '').replace(/,\s*/g, ', ');
  return titleCaseInternal(s);
}

function titleCaseInternal(s: string): string {
  const ACRONYMS = new Set(['TP', 'AGE', 'PSE', 'SPL', 'VRD', 'BTP', 'CE', 'NF']);
  const PROPER_NOUNS = new Set([
    'procity', 'vialux',
    'province', 'conviviale', 'modulo', 'milan', 'voute', 'voûte', 'venise', 'turin', 'kub',
    'heritage', 'héritage', 'lisbonne', 'pagode', 'orleans', 'orléans', 'linea', 'trio',
    'losange', 'carrefour', 'agora', 'boule', 'city', 'serrubloc',
    'berlinois',
  ]);

  // Split sur espace, tiret ou virgule (conserve les séparateurs)
  const tokens = s.split(/(\s+|-|,)/);
  let seenFirstWord = false;
  return tokens
    .map((w) => {
      if (/^\s+$/.test(w) || w === '-' || w === ',') return w;
      const upper = w.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      // Normaliser pour détecter les noms propres (sans accents ni ®)
      const norm = w
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[®©™]/g, '')
        .toLowerCase();
      const isProperNoun = PROPER_NOUNS.has(norm);
      const lower = w.toLowerCase();
      if (!seenFirstWord || isProperNoun) {
        seenFirstWord = true;
        return lower.length > 0 ? lower[0].toUpperCase() + lower.slice(1) : '';
      }
      return lower;
    })
    .join('');
}

export interface ProcityTaxonomy {
  universes: Array<{
    slug: UniverseSlug;
    name: string;
    categories: Array<{
      slug: string;
      name: string;
      types: Array<{ slug: string; name: string; count: number }>;
    }>;
  }>;
}

export async function buildTaxonomy(excelPath: string): Promise<ProcityTaxonomy> {
  const rows = await parseTarifExcel(excelPath);

  // universe → category → type → count
  const tree = new Map<UniverseSlug, Map<string, Map<string, number>>>();
  for (const r of rows) {
    let universe: UniverseSlug;
    if (r.sheet === 'MOBILIER URBAIN') universe = 'mobilier-urbain';
    else if (r.sheet === 'AIRES DE JEUX') universe = 'aires-de-jeux';
    else if (r.sheet === 'ÉQUIPEMENTS SPORTIFS') universe = 'equipements-sportifs';
    else if (r.sheet === 'MIROIRS') universe = 'miroirs';
    else continue;

    const cat = (r.category || '').trim();
    const type = (r.productType || '').trim();
    if (!cat || !type) continue;

    if (!tree.has(universe)) tree.set(universe, new Map());
    const catMap = tree.get(universe)!;
    if (!catMap.has(cat)) catMap.set(cat, new Map());
    const typeMap = catMap.get(cat)!;
    typeMap.set(type, (typeMap.get(type) || 0) + 1);
  }

  const result: ProcityTaxonomy = { universes: [] };
  for (const universe of UNIVERSE_ORDER) {
    const catMap = tree.get(universe);
    if (!catMap) continue;
    const cats = [...catMap.entries()]
      .map(([catName, typeMap]) => {
        const types = [...typeMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([typeName, count]) => ({
            slug: slugify(typeName),
            name: titleCase(typeName),
            count,
          }));
        return {
          slug: slugify(catName),
          name: titleCase(catName),
          types,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    result.universes.push({
      slug: universe,
      name: UNIVERSE_NAMES[universe],
      categories: cats,
    });
  }
  return result;
}

/**
 * Mapping univers Procity → id catégorie SAPAL existante (on réutilise
 * pour éviter les conflits sur la contrainte unique du slug).
 * Ces 4 catégories existent déjà, on les upgrade simplement en niveau 1
 * avec la bonne valeur `universe`.
 */
const UNIVERSE_TO_SAPAL_ID: Record<UniverseSlug, { id: string; slug: string; name: string }> = {
  'mobilier-urbain':       { id: '1',  slug: 'mobilier-urbain',      name: 'Mobilier urbain' },
  'aires-de-jeux':         { id: '12', slug: 'aires-de-jeux',        name: 'Aires de jeux' },
  'equipements-sportifs':  { id: '13', slug: 'equipements-sportifs', name: 'Équipements sportifs' },
  // L'univers Miroirs Procity : id SAPAL existant 14, slug renommé en "miroirs"
  // (ex "miroirs-securite") pour correspondre à la taxonomie Excel/Procity.
  miroirs:                 { id: '14', slug: 'miroirs',              name: 'Miroirs' },
};

export function makeUniverseId(u: UniverseSlug): string {
  return UNIVERSE_TO_SAPAL_ID[u].id;
}
export function makeCategoryId(u: UniverseSlug, catSlug: string): string {
  return `proc-${u}-${catSlug}`;
}
export function makeTypeId(u: UniverseSlug, catSlug: string, typeSlug: string): string {
  return `proc-${u}-${catSlug}-${typeSlug}`;
}

async function main() {
  const EXCEL =
    '/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Fournisseurs/Procity/tarifprocityvialux2026-fr.v1.7-699.xlsx';
  const taxonomy = await buildTaxonomy(EXCEL);
  const supabase = getProcitySupabaseClient();

  let upsertedU = 0, upsertedC = 0, upsertedT = 0;

  let universeOrder = 0;
  for (const u of taxonomy.universes) {
    universeOrder += 10;
    const mapping = UNIVERSE_TO_SAPAL_ID[u.slug];
    const universeId = mapping.id;
    // UPDATE uniquement pour les univers qui existent déjà — on ne change ni id ni slug
    // (le slug legacy `miroirs-securite` est conservé pour ne pas casser les URL existantes).
    const { error: errU } = await supabase
      .from('categories')
      .update({
        name: mapping.name,
        parent_id: null,
        level: 1,
        universe: u.slug,
        sort_order: universeOrder,
      })
      .eq('id', universeId);
    if (errU) throw new Error(`update universe ${universeId}: ${errU.message}`);
    upsertedU++;

    let catOrder = 0;
    for (const c of u.categories) {
      catOrder += 10;
      const catId = makeCategoryId(u.slug, c.slug);
      const { error: errC } = await supabase.from('categories').upsert(
        {
          id: catId,
          name: c.name,
          slug: c.slug,
          description: '',
          image_url: '',
          parent_id: universeId,
          level: 2,
          universe: u.slug,
          sort_order: catOrder,
        },
        { onConflict: 'id' },
      );
      if (errC) throw new Error(`upsert cat ${catId}: ${errC.message}`);
      upsertedC++;

      let typeOrder = 0;
      for (const t of c.types) {
        typeOrder += 10;
        const typeId = makeTypeId(u.slug, c.slug, t.slug);
        const { error: errT } = await supabase.from('categories').upsert(
          {
            id: typeId,
            name: t.name,
            slug: t.slug,
            description: '',
            image_url: '',
            parent_id: catId,
            level: 3,
            universe: u.slug,
            sort_order: typeOrder,
          },
          { onConflict: 'id' },
        );
        if (errT) throw new Error(`upsert type ${typeId}: ${errT.message}`);
        upsertedT++;
      }
    }
  }

  console.log(`[seed] upserted: ${upsertedU} univers, ${upsertedC} catégories, ${upsertedT} types`);
}

if (process.argv[1]?.includes('seed-categories')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
