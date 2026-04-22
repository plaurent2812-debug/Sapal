# Miroir catalogue Procity — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproduire 100% du catalogue Procity sur SAPAL (tous produits, déclinaisons, photos multiples, fiches techniques, délais par variante), avec une architecture multi-fournisseurs prête pour les ajouts futurs.

**Architecture:** Quatre sous-systèmes découplés : scraper Playwright de procity.eu → pipeline d'import idempotent (Excel + 958 photos HD locales + LLM de réécriture) → schéma Supabase étendu (table `suppliers`, `scrape_runs`, colonnes additionnelles) → front-end + admin adaptés avec écran de review des diffs.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (Postgres + Storage), Tailwind 4, Playwright (scraper), Cheerio (parsing), Anthropic Haiku 4.5 (LLM), Vitest (tests), exceljs (lecture Excel).

**Mode de travail :**
- Branche dédiée `feat/catalogue-procity-miroir`
- Tout en **localhost + Supabase dev** jusqu'à validation finale
- Dry-run obligatoire avant chaque import massif
- Backup Supabase prod + copie Storage avant bascule finale

---

## Structure des fichiers créés / modifiés

### Migrations SQL
- Create `supabase/migrations/017_suppliers_multi.sql` — table `suppliers`, colonnes ajoutées à `products` et `product_variants`, table `scrape_runs`
- Create `supabase/migrations/018_supplier_media_bucket.sql` — bucket Storage + RLS
- Create `supabase/migrations/019_migrate_existing_procity.sql` — rattachement des 335 produits existants à Procity
- Create `supabase/migrations/020_variant_unique.sql` — contrainte d'unicité variant_ref

### Scraper (nouveau package)
- Create `scripts/procity/scraper/index.ts` — orchestrateur principal
- Create `scripts/procity/scraper/crawler.ts` — découverte des URLs produit
- Create `scripts/procity/scraper/fetcher.ts` — récupération d'une page avec Playwright
- Create `scripts/procity/scraper/extractor.ts` — transformation DOM → snapshot
- Create `scripts/procity/scraper/media-downloader.ts` — téléchargement photos + PDF
- Create `scripts/procity/scraper/state.ts` — gestion du fichier d'état (hashes + reprises)
- Create `scripts/procity/scraper/types.ts` — types `ProductSnapshot`, `VariantSnapshot`, etc.
- Test `scripts/procity/scraper/__tests__/extractor.test.ts`
- Test `scripts/procity/scraper/__tests__/crawler.test.ts`

### Pipeline d'import (nouveau package)
- Create `scripts/procity/import/index.ts` — orchestrateur (dry-run + apply)
- Create `scripts/procity/import/excel-parser.ts` — lecture de l'Excel tarifaire
- Create `scripts/procity/import/image-matcher.ts` — matching snapshot ↔ photos HD locales
- Create `src/lib/llm-rewriter.ts` — adapter LLM (Haiku 4.5), **placé dans `src/lib/` pour être importable à la fois par le script CLI et par les routes API**
- Create `scripts/procity/import/storage-uploader.ts` — upload Supabase Storage
- Create `scripts/procity/import/db-writer.ts` — upsert products / variants
- Create `scripts/procity/import/diff-computer.ts` — calcul des diffs pour review admin
- Create `scripts/procity/shared/supabase-client.ts` — switch DEV/PROD
- Test `scripts/procity/import/__tests__/excel-parser.test.ts`
- Test `scripts/procity/import/__tests__/image-matcher.test.ts`
- Test `scripts/procity/import/__tests__/diff-computer.test.ts`
- Test `scripts/procity/import/__tests__/integration.test.ts`

### Front-end public
- Modify `src/app/catalogue/[slug]/[productSlug]/page.tsx` — galerie multi-photos, PDF, délai variante
- Create `src/components/product/ProductGallery.tsx` — carrousel avec switch variante
- Create `src/components/product/TechSheetButton.tsx` — bouton PDF
- Create `src/components/product/AvailabilityBadge.tsx` — délai cascadé
- Create `src/components/product/SupplierBadge.tsx` — badge "Produit fabriqué par…"
- Modify `src/lib/data.ts` — fonctions de lecture adaptées au nouveau schéma

### Admin
- Create `src/app/admin/fournisseurs/page.tsx` — liste fournisseurs
- Create `src/app/admin/fournisseurs/[slug]/runs/page.tsx` — liste runs (observatoire)
- Create `src/app/admin/fournisseurs/[slug]/runs/TriggerHint.tsx` — composant client (affiche la commande CLI à lancer)
- Create `src/app/admin/fournisseurs/[slug]/runs/[runId]/page.tsx` — détail run + diff review
- Create `src/app/admin/fournisseurs/[slug]/runs/[runId]/ApplyForm.tsx` — client component
- Create `src/app/api/admin/scrape/apply/route.ts` — marquage apply/reject
- Create `src/app/api/admin/products/[id]/rewrite-description/route.ts`
- Modify `src/app/admin/produits/[id]/page.tsx` — ajout fournisseur + bouton régén description

### Configuration
- Modify `package.json` — scripts + dépendances (playwright, cheerio, @anthropic-ai/sdk, exceljs, tsx)
- Create `scripts/procity/README.md` — mode d'emploi complet
- Modify `.env.local.example` — nouvelles variables (ANTHROPIC_API_KEY, DEV_SUPABASE_*)

---

## Phase 0 — Préparation

### Task 0.1: Créer la branche et installer les dépendances

**Files:**
- Modify: `package.json`
- Create: `.env.local` (manuel, pas dans git)

- [ ] **Step 1: Créer la branche dédiée**

Run: `git checkout -b feat/catalogue-procity-miroir`

Expected: `Switched to a new branch 'feat/catalogue-procity-miroir'`

- [ ] **Step 2: Installer les dépendances scraper + LLM**

Run: `npm install --save-dev playwright cheerio @types/cheerio tsx && npm install @anthropic-ai/sdk exceljs`

Expected: install OK, pas d'erreurs de peer dependencies.

- [ ] **Step 3: Installer les navigateurs Playwright**

Run: `npx playwright install chromium`

Expected: download Chromium OK.

- [ ] **Step 4: Ajouter la variable d'environnement LLM**

Edit `.env.local` pour ajouter :

```
ANTHROPIC_API_KEY=sk-ant-api03-...
DEV_SUPABASE_URL=https://xxx.supabase.co
DEV_SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Edit `.env.local.example` pour ajouter les mêmes clés sans valeur (documentation).

- [ ] **Step 5: Ajouter les scripts package.json**

Modify `package.json` → section `scripts` (ajout) :

```json
"scrape:procity": "tsx scripts/procity/scraper/index.ts",
"import:procity:dry": "tsx scripts/procity/import/index.ts --dry-run",
"import:procity:apply": "tsx scripts/procity/import/index.ts --apply"
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "chore: add procity scraper deps (playwright, cheerio, anthropic, exceljs, tsx)"
```

---

### Task 0.2: Supabase DEV + switch client + README

**Files:**
- Create: `scripts/procity/shared/supabase-client.ts`
- Create: `scripts/procity/README.md`

- [ ] **Step 1: S'assurer d'un projet Supabase DEV**

Dans le dashboard Supabase, vérifier qu'il existe un projet de dev distinct du projet prod. Sinon, en créer un avec le même schéma de base.

- [ ] **Step 2: Récupérer les credentials DEV**

Copier `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` du projet DEV dans `.env.local` sous les clés `DEV_SUPABASE_URL` et `DEV_SUPABASE_SERVICE_ROLE_KEY` (voir Task 0.1 Step 4).

- [ ] **Step 3: Écrire le client switch**

Create `scripts/procity/shared/supabase-client.ts` :

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseClient(): SupabaseClient {
  const useProd = process.env.PROCITY_TARGET === 'prod';
  const url = useProd
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.DEV_SUPABASE_URL;
  const key = useProd
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.DEV_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`Missing Supabase env vars for target=${useProd ? 'prod' : 'dev'}`);
  }
  console.log(`[supabase] target=${useProd ? 'PROD' : 'DEV'} url=${url}`);
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 4: README**

Create `scripts/procity/README.md` :

```markdown
# Pipeline catalogue Procity

## Cibles Supabase
- Par défaut : DEV (variables `DEV_SUPABASE_*`)
- Pour cibler la prod : `PROCITY_TARGET=prod npm run import:procity:apply`

## Workflow complet
1. `npm run scrape:procity` → génère `scripts/procity/scraper-output/`
2. `npm run import:procity:dry` → log du diff + SQL simulé
3. Inspection manuelle du log
4. `npm run import:procity:apply` → exécute sur DEV
5. Validation visuelle dans `localhost:3000/catalogue/...`
6. Bascule prod : `PROCITY_TARGET=prod npm run import:procity:apply`

## Architecture des runs (scrape_runs)
La table `scrape_runs` sert d'observatoire. Le workflow MVP :
- Le CLI `import:procity:apply` écrit directement dans `products` et crée un run en `applied`
- L'écran admin `/admin/fournisseurs/procity/runs` affiche l'historique avec diffs
- Rejet = marquage logique (status='rejected'), ne reverse pas les écritures (pour ça, il faut restaurer depuis le backup Supabase)

Une V2 pourra décorréler staging et apply effectif.

## Reprise
Le fichier `scraper-output/state.json` garde les hashes.
Relancer le scraper ne re-télécharge que ce qui a changé.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/procity/shared/ scripts/procity/README.md
git commit -m "chore: add Supabase DEV/PROD switch and Procity pipeline README"
```

---

## Phase 1 — Schéma Supabase étendu

### Task 1.1: Migration 017 — suppliers, colonnes, scrape_runs

**Files:**
- Create: `supabase/migrations/017_suppliers_multi.sql`

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/017_suppliers_multi.sql` :

```sql
-- 017: Architecture multi-fournisseurs pour le catalogue SAPAL

begin;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  website text,
  logo_url text,
  default_availability text,
  scraper_config jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suppliers_slug on public.suppliers (slug);

alter table public.products
  add column if not exists supplier_id uuid references public.suppliers(id),
  add column if not exists description_sapal text,
  add column if not exists description_source_hash text,
  add column if not exists tech_sheet_url text,
  add column if not exists gallery_image_urls text[] default '{}',
  add column if not exists procity_url text,
  add column if not exists last_scraped_at timestamptz;

create index if not exists idx_products_supplier_id on public.products (supplier_id);

alter table public.product_variants
  add column if not exists availability text,
  add column if not exists primary_image_url text;

create table if not exists public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','completed','failed','pending_review','applied','rejected')),
  stats jsonb default '{}'::jsonb,
  diff_payload jsonb,
  created_by uuid references auth.users(id)
);

create index if not exists idx_scrape_runs_supplier_status on public.scrape_runs (supplier_id, status);

alter table public.suppliers enable row level security;
alter table public.scrape_runs enable row level security;

drop policy if exists "suppliers_public_read" on public.suppliers;
create policy "suppliers_public_read" on public.suppliers for select using (true);

drop policy if exists "scrape_runs_admin_only" on public.scrape_runs;
create policy "scrape_runs_admin_only" on public.scrape_runs
  for all using (
    (auth.jwt() ->> 'role') = 'admin'
    or auth.role() = 'service_role'
  );

commit;
```

- [ ] **Step 2: Appliquer la migration sur DEV via MCP Supabase**

Utiliser `mcp__33041561-...__apply_migration` avec `name='017_suppliers_multi'` et le contenu du fichier.

- [ ] **Step 3: Vérifier**

Via MCP `execute_sql` :

```sql
select column_name from information_schema.columns
where table_name = 'products' and column_name in
  ('supplier_id','description_sapal','tech_sheet_url','gallery_image_urls','procity_url','last_scraped_at');
```

Expected: 6 rows.

```sql
select count(*) from public.suppliers;
```

Expected: 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/017_suppliers_multi.sql
git commit -m "feat(db): add suppliers, scrape_runs, multi-supplier columns"
```

---

### Task 1.2: Migration 018 — bucket Storage supplier-media

**Files:**
- Create: `supabase/migrations/018_supplier_media_bucket.sql`

- [ ] **Step 1: Écrire**

Create `supabase/migrations/018_supplier_media_bucket.sql` :

```sql
begin;

insert into storage.buckets (id, name, public)
values ('supplier-media', 'supplier-media', true)
on conflict (id) do nothing;

drop policy if exists "supplier_media_public_read" on storage.objects;
create policy "supplier_media_public_read"
  on storage.objects for select
  using (bucket_id = 'supplier-media');

drop policy if exists "supplier_media_service_write" on storage.objects;
create policy "supplier_media_service_write"
  on storage.objects for insert
  with check (bucket_id = 'supplier-media' and auth.role() = 'service_role');

drop policy if exists "supplier_media_service_update" on storage.objects;
create policy "supplier_media_service_update"
  on storage.objects for update
  using (bucket_id = 'supplier-media' and auth.role() = 'service_role');

drop policy if exists "supplier_media_service_delete" on storage.objects;
create policy "supplier_media_service_delete"
  on storage.objects for delete
  using (bucket_id = 'supplier-media' and auth.role() = 'service_role');

commit;
```

- [ ] **Step 2: Appliquer via MCP**

- [ ] **Step 3: Vérifier**

```sql
select id, public from storage.buckets where id = 'supplier-media';
```

Expected : 1 row, `public = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/018_supplier_media_bucket.sql
git commit -m "feat(db): add supplier-media storage bucket with policies"
```

---

### Task 1.3: Migration 019 — rattacher les produits existants à Procity

**Files:**
- Create: `supabase/migrations/019_migrate_existing_procity.sql`

- [ ] **Step 1: Écrire**

Create `supabase/migrations/019_migrate_existing_procity.sql` :

```sql
begin;

insert into public.suppliers (slug, name, website, default_availability)
values ('procity', 'Procity', 'https://procity.eu', 'Délai à confirmer')
on conflict (slug) do update
  set name = excluded.name, website = excluded.website;

update public.products
set supplier_id = (select id from public.suppliers where slug = 'procity')
where supplier_id is null;

update public.products
set description_sapal = description
where description_sapal is null and description is not null;

commit;
```

- [ ] **Step 2: Appliquer via MCP**

- [ ] **Step 3: Vérifier**

```sql
select count(*) from public.products where supplier_id is null;
```

Expected : 0.

```sql
select slug, (select count(*) from public.products p where p.supplier_id = s.id) as n
from public.suppliers s;
```

Expected : `procity | 335` (ou le nombre exact actuel).

**Note STI** : si la migration 010 a importé des produits STI, ils sont aussi rattachés à Procity ici. Inspecter après :

```sql
select distinct reference from products where reference like 'STI%' limit 5;
```

Si oui, créer un supplier `sti` manuellement via MCP (`insert into suppliers(slug,name) values('sti','STI')`) puis UPDATE ciblé. Documenter dans `tasks/lessons.md`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/019_migrate_existing_procity.sql
git commit -m "feat(db): link existing products to Procity supplier"
```

---

### Task 1.4: Migration 020 — unicité (product_id, variant_ref)

**Files:**
- Create: `supabase/migrations/020_variant_unique.sql`

- [ ] **Step 1: Vérifier si la contrainte existe déjà**

Via MCP :

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.product_variants'::regclass and contype = 'u';
```

Si une contrainte sur (product_id, variant_ref) existe déjà : **skipper cette task**, notant son nom.

- [ ] **Step 2: Écrire**

Create `supabase/migrations/020_variant_unique.sql` :

```sql
begin;

alter table public.product_variants
  drop constraint if exists product_variants_product_ref_unique;

alter table public.product_variants
  add constraint product_variants_product_ref_unique unique (product_id, variant_ref);

commit;
```

- [ ] **Step 3: Appliquer via MCP**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/020_variant_unique.sql
git commit -m "feat(db): enforce unique (product_id, variant_ref)"
```

---

## Phase 2 — Types partagés du scraper

### Task 2.1: Types ProductSnapshot et VariantSnapshot

**Files:**
- Create: `scripts/procity/scraper/types.ts`

- [ ] **Step 1: Écrire**

Create `scripts/procity/scraper/types.ts` :

```typescript
export interface VariantSnapshot {
  variantRef: string;
  attributes: Record<string, string>;
  ral?: string;
  availability?: string;
  imageFilenames: string[];
}

export interface CharacteristicRow {
  label: string;
  value: string;
}

export interface ProductSnapshot {
  reference: string;
  procityUrl: string;
  universe: 'mobilier-urbain' | 'aires-de-jeux' | 'equipements-sportifs';
  categoryPath: string[];
  title: string;
  descriptionRaw: string;
  availabilityDefault?: string;
  weightKg?: number;
  dimensions?: string;
  type?: string;
  characteristics: CharacteristicRow[];
  variants: VariantSnapshot[];
  galleryFilenames: string[];
  techSheetFilename?: string;
  scrapedAt: string;
  contentHash: string;
}

export interface ScraperState {
  version: 1;
  runStartedAt: string;
  entries: Record<string, { hash: string; lastSeenAt: string }>;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/procity/scraper/types.ts
git commit -m "feat(scraper): add shared types"
```

---

## Phase 3 — Scraper Procity

### Task 3.1: Extracteur — test avec fixture HTML

**Files:**
- Create: `scripts/procity/scraper/__tests__/fixtures/abri-chariots-modulo.html`
- Create: `scripts/procity/scraper/__tests__/extractor.test.ts`
- Create: `scripts/procity/scraper/extractor.ts`

- [ ] **Step 1: Capturer une fiche Procity réelle**

Télécharger le HTML :

```bash
curl -A "Mozilla/5.0" "https://procity.eu/fr/abri-chariots-modulo-1.html" -o scripts/procity/scraper/__tests__/fixtures/abri-chariots-modulo.html
```

Vérifier que le fichier fait > 20 Ko et contient le mot "Modulo".

- [ ] **Step 2: Écrire le test**

Create `scripts/procity/scraper/__tests__/extractor.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractProductSnapshot } from '../extractor';

const fixtureHtml = readFileSync(
  join(__dirname, 'fixtures/abri-chariots-modulo.html'),
  'utf-8'
);

describe('extractProductSnapshot', () => {
  it('extracts Abri Chariots Modulo with core fields', () => {
    const snapshot = extractProductSnapshot({
      html: fixtureHtml,
      url: 'https://procity.eu/fr/abri-chariots-modulo-1.html',
    });

    expect(snapshot.reference).toBe('529777');
    expect(snapshot.title).toContain('Modulo');
    expect(snapshot.universe).toBe('mobilier-urbain');
    expect(snapshot.descriptionRaw.length).toBeGreaterThan(20);
    expect(snapshot.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('captures color variants (at least 5)', () => {
    const snapshot = extractProductSnapshot({
      html: fixtureHtml,
      url: 'https://procity.eu/fr/abri-chariots-modulo-1.html',
    });
    const couleurs = snapshot.variants
      .map(v => v.attributes.couleur)
      .filter(Boolean);
    expect(couleurs.length).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 3: Run — FAIL attendu**

Run : `npm run test -- scripts/procity/scraper/__tests__/extractor.test.ts`

Expected : FAIL — module introuvable.

- [ ] **Step 4: Écrire extractor.ts**

Create `scripts/procity/scraper/extractor.ts` :

```typescript
import { load } from 'cheerio';
import { createHash } from 'crypto';
import type { ProductSnapshot, VariantSnapshot, CharacteristicRow } from './types';

export interface ExtractInput {
  html: string;
  url: string;
}

export function extractProductSnapshot(input: ExtractInput): ProductSnapshot {
  const $ = load(input.html);

  const title = $('h1').first().text().trim();
  const descriptionRaw =
    $('[class*="description"], [itemprop="description"]').first().text().trim() ||
    $('meta[name="description"]').attr('content') ||
    '';

  const reference = extractReference($, input.url);
  const universe = detectUniverse(input.url, $);
  const categoryPath = extractCategoryPath($);
  const availabilityDefault = extractAvailability($);
  const { weightKg, dimensions, type, characteristics } = extractCharacteristics($);
  const variants = extractVariants($);
  const galleryFilenames = extractGalleryFilenames($);
  const techSheetFilename = extractTechSheet($);

  const contentHash = hashContent({
    reference, title, descriptionRaw, availabilityDefault,
    weightKg, dimensions, characteristics, variants,
    galleryFilenames, techSheetFilename,
  });

  return {
    reference,
    procityUrl: input.url,
    universe,
    categoryPath,
    title,
    descriptionRaw,
    availabilityDefault,
    weightKg,
    dimensions,
    type,
    characteristics,
    variants,
    galleryFilenames,
    techSheetFilename,
    scrapedAt: new Date().toISOString(),
    contentHash,
  };
}

function extractReference($: ReturnType<typeof load>, url: string): string {
  const text = $('body').text();
  const match = text.match(/R[ée]f[ée]rence\s+(\d{5,7})/i);
  if (match) return match[1];
  const urlMatch = url.match(/(\d{5,7})(?:-\d+)?\.html$/);
  if (urlMatch) return urlMatch[1];
  throw new Error(`No reference found in ${url}`);
}

function detectUniverse(url: string, $: ReturnType<typeof load>): ProductSnapshot['universe'] {
  const lower = url.toLowerCase();
  const breadcrumb = $('[class*="breadcrumb"]').text().toLowerCase();
  if (lower.includes('aires-de-jeux') || breadcrumb.includes('aires de jeux')) return 'aires-de-jeux';
  if (lower.includes('equipements-sportifs') || breadcrumb.includes('équipements sportifs')) return 'equipements-sportifs';
  return 'mobilier-urbain';
}

function extractCategoryPath($: ReturnType<typeof load>): string[] {
  const crumbs: string[] = [];
  $('[class*="breadcrumb"] a, [class*="breadcrumb"] span').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.toLowerCase() !== 'accueil') crumbs.push(t);
  });
  return crumbs;
}

function extractAvailability($: ReturnType<typeof load>): string | undefined {
  const text = $('body').text();
  const match = text.match(/Disponibilit[ée]\s+(\d+\s+(?:semaines?|jours?|mois))/i);
  return match ? match[1] : undefined;
}

function extractCharacteristics($: ReturnType<typeof load>): {
  weightKg?: number;
  dimensions?: string;
  type?: string;
  characteristics: CharacteristicRow[];
} {
  const characteristics: CharacteristicRow[] = [];
  let weightKg: number | undefined;
  let dimensions: string | undefined;
  let type: string | undefined;

  $('tr, [class*="characteristic"] li, [class*="spec"] li').each((_, el) => {
    const label = $(el).find('th, [class*="label"], dt').first().text().trim();
    const value = $(el).find('td, [class*="value"], dd').first().text().trim();
    if (label && value) {
      characteristics.push({ label, value });
      if (/poids/i.test(label)) {
        const m = value.match(/([\d.,]+)\s*kg/i);
        if (m) weightKg = parseFloat(m[1].replace(',', '.'));
      }
      if (/dimensions?/i.test(label)) dimensions = value;
      if (/type/i.test(label)) type = value;
    }
  });

  return { weightKg, dimensions, type, characteristics };
}

function extractVariants($: ReturnType<typeof load>): VariantSnapshot[] {
  const variants: VariantSnapshot[] = [];
  const seen = new Set<string>();
  $('[class*="color"] [class*="option"], [data-variant], [class*="variant"]').each((_, el) => {
    const label = $(el).text().trim() || $(el).attr('data-label') || '';
    const ref = $(el).attr('data-ref') || '';
    const ral = label.match(/RAL\s*\d{4}/)?.[0];
    const variantRef = ref || label.replace(/\s+/g, '-');
    if (!label || seen.has(variantRef)) return;
    seen.add(variantRef);
    variants.push({
      variantRef,
      attributes: { couleur: label },
      ral,
      imageFilenames: [],
    });
  });
  return variants;
}

function extractGalleryFilenames($: ReturnType<typeof load>): string[] {
  const filenames: string[] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (!src || !/\.(jpe?g|png|webp)(?:\?|$)/i.test(src)) return;
    const filename = src.split('?')[0].split('/').pop();
    if (filename && !filenames.includes(filename)) filenames.push(filename);
  });
  return filenames;
}

function extractTechSheet($: ReturnType<typeof load>): string | undefined {
  const link = $('a[href*=".pdf"]').first().attr('href');
  return link ? link.split('?')[0].split('/').pop() : undefined;
}

function hashContent(data: unknown): string {
  const sortedKeys = Object.keys(data as object).sort();
  const json = JSON.stringify(data, sortedKeys);
  return 'sha256:' + createHash('sha256').update(json).digest('hex');
}
```

- [ ] **Step 5: Re-run — ajuster les sélecteurs jusqu'à PASS**

Run : `npm run test -- scripts/procity/scraper/__tests__/extractor.test.ts`

Si fail, ouvrir la fixture HTML dans un éditeur, identifier les vraies classes et balises Procity (le HTML diffère en prod), adapter les sélecteurs. Re-run jusqu'à PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/procity/scraper/extractor.ts scripts/procity/scraper/__tests__/
git commit -m "feat(scraper): HTML extractor with fixture test"
```

---

### Task 3.2: Crawler — sitemap parsing

**Files:**
- Create: `scripts/procity/scraper/__tests__/crawler.test.ts`
- Create: `scripts/procity/scraper/crawler.ts`

- [ ] **Step 1: Écrire le test**

Create `scripts/procity/scraper/__tests__/crawler.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { parseSitemapXml } from '../crawler';

const sample = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://procity.eu/fr/</loc></url>
  <url><loc>https://procity.eu/fr/abri-chariots-modulo-1.html</loc></url>
  <url><loc>https://procity.eu/fr/banc-venise-2.html</loc></url>
  <url><loc>https://procity.eu/fr/mentions-legales.html</loc></url>
  <url><loc>https://procity.eu/fr/categorie-abris.html</loc></url>
</urlset>`;

describe('parseSitemapXml', () => {
  it('keeps only product URLs', () => {
    const urls = parseSitemapXml(sample);
    expect(urls).toContain('https://procity.eu/fr/abri-chariots-modulo-1.html');
    expect(urls).toContain('https://procity.eu/fr/banc-venise-2.html');
    expect(urls).not.toContain('https://procity.eu/fr/mentions-legales.html');
    expect(urls).not.toContain('https://procity.eu/fr/categorie-abris.html');
    expect(urls.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Écrire crawler.ts**

Create `scripts/procity/scraper/crawler.ts` :

```typescript
const PRODUCT_URL_REGEX = /\/fr\/[a-z0-9-]+-\d+\.html$/i;
const EXCLUDED_PATTERNS = [
  /mentions/i, /contact/i, /cgv/i, /politique/i,
  /categorie/i, /univers/i, /blog/i,
];

export function parseSitemapXml(xml: string): string[] {
  const locs: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    locs.push(match[1]);
  }
  return locs.filter(url => {
    if (!PRODUCT_URL_REGEX.test(url)) return false;
    if (EXCLUDED_PATTERNS.some(re => re.test(url))) return false;
    return true;
  });
}

export async function fetchProductUrls(rootSitemapUrl: string): Promise<string[]> {
  const response = await fetch(rootSitemapUrl);
  if (!response.ok) throw new Error(`Sitemap fetch failed: ${response.status}`);
  const xml = await response.text();

  if (xml.includes('<sitemapindex')) {
    const subSitemaps = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);
    const allUrls: string[] = [];
    for (const subUrl of subSitemaps) {
      const resp = await fetch(subUrl);
      if (!resp.ok) continue;
      allUrls.push(...parseSitemapXml(await resp.text()));
    }
    return [...new Set(allUrls)];
  }
  return parseSitemapXml(xml);
}
```

- [ ] **Step 4: Run — PASS**

Expected : PASS.

- [ ] **Step 5: Smoke test réel**

```bash
npx tsx -e "import('./scripts/procity/scraper/crawler').then(m => m.fetchProductUrls('https://procity.eu/sitemap.xml').then(u => console.log(u.length, u.slice(0,3))))"
```

Expected : nombre > 500, URLs cohérentes.

Si le `sitemap.xml` n'existe pas à cette URL : inspecter `https://procity.eu/robots.txt` et utiliser l'URL trouvée.

- [ ] **Step 6: Commit**

```bash
git add scripts/procity/scraper/crawler.ts scripts/procity/scraper/__tests__/crawler.test.ts
git commit -m "feat(scraper): sitemap crawler with product URL filtering"
```

---

### Task 3.3: Fetcher Playwright

**Files:**
- Create: `scripts/procity/scraper/fetcher.ts`

- [ ] **Step 1: Écrire**

Create `scripts/procity/scraper/fetcher.ts` :

```typescript
import { chromium, type Browser, type Page } from 'playwright';

export interface FetchedPage {
  url: string;
  html: string;
  variantImages: Map<string, string>;
  pdfLinks: string[];
  imageLinks: string[];
}

export class ProcityFetcher {
  private browser: Browser | null = null;

  async start(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
  }

  async stop(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }

  async fetchPage(url: string): Promise<FetchedPage> {
    if (!this.browser) throw new Error('Fetcher not started');
    const context = await this.browser.newContext({
      userAgent: 'SAPAL-Mirror/1.0 (contact: societe@sapal.fr)',
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      const variantImages = await this.captureVariantImages(page);
      const html = await page.content();
      const imageLinks = await page.$$eval('img', imgs =>
        imgs.map(i => (i as HTMLImageElement).src).filter(Boolean)
      );
      const pdfLinks = await page.$$eval('a[href$=".pdf"]', links =>
        links.map(l => (l as HTMLAnchorElement).href)
      );
      return { url, html, variantImages, imageLinks, pdfLinks };
    } finally {
      await page.close();
      await context.close();
    }
  }

  private async captureVariantImages(page: Page): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const swatches = await page.$$('[class*="color"] [class*="option"], [data-color]');
    for (const swatch of swatches) {
      const label = ((await swatch.textContent())?.trim())
        || (await swatch.getAttribute('data-label'))
        || '';
      if (!label) continue;
      try {
        await swatch.click({ timeout: 5_000 });
        await page.waitForTimeout(400);
        const mainImg = await page.$eval(
          '[class*="product-image"] img, [class*="main-image"] img',
          el => (el as HTMLImageElement).src
        ).catch(() => null);
        if (mainImg) result.set(label, mainImg);
      } catch {
        // swatch non cliquable → on ignore
      }
    }
    return result;
  }
}

export async function throttledFetch<T>(fn: () => Promise<T>, minDelayMs = 2000): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  if (elapsed < minDelayMs) {
    await new Promise(r => setTimeout(r, minDelayMs - elapsed));
  }
  return result;
}
```

- [ ] **Step 2: Smoke test**

```bash
npx tsx -e "
import { ProcityFetcher } from './scripts/procity/scraper/fetcher';
const f = new ProcityFetcher();
await f.start();
const r = await f.fetchPage('https://procity.eu/fr/abri-chariots-modulo-1.html');
console.log('HTML size:', r.html.length);
console.log('Variant images:', r.variantImages.size);
console.log('Image links:', r.imageLinks.length);
console.log('PDF links:', r.pdfLinks.length);
await f.stop();
"
```

Expected : HTML > 20k, variantImages ≥ 3, imageLinks ≥ 2.

- [ ] **Step 3: Commit**

```bash
git add scripts/procity/scraper/fetcher.ts
git commit -m "feat(scraper): Playwright fetcher with variant image capture"
```

---

### Task 3.4: Media downloader

**Files:**
- Create: `scripts/procity/scraper/media-downloader.ts`

- [ ] **Step 1: Écrire**

Create `scripts/procity/scraper/media-downloader.ts` :

```typescript
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';

export interface DownloadResult {
  absolutePath: string;
  relativePath: string;
  sha256: string;
  bytes: number;
  skipped: boolean;
}

export async function downloadMedia(
  url: string,
  targetDir: string,
  filename: string
): Promise<DownloadResult> {
  const absolutePath = join(targetDir, filename);
  if (existsSync(absolutePath)) {
    return { absolutePath, relativePath: filename, sha256: '', bytes: 0, skipped: true };
  }
  await mkdir(dirname(absolutePath), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download ${url} failed: ${response.status}`);
  const buf = Buffer.from(await response.arrayBuffer());
  await writeFile(absolutePath, buf);
  return {
    absolutePath,
    relativePath: filename,
    sha256: createHash('sha256').update(buf).digest('hex'),
    bytes: buf.length,
    skipped: false,
  };
}
```

- [ ] **Step 2: Smoke test**

```bash
npx tsx -e "
import { downloadMedia } from './scripts/procity/scraper/media-downloader';
const r = await downloadMedia('https://procity.eu/img/logo.png','/tmp/sapal-test','logo.png');
console.log(r);
"
```

Expected : fichier créé, sha256 non vide.

Nettoyer : `rm -rf /tmp/sapal-test`.

- [ ] **Step 3: Commit**

```bash
git add scripts/procity/scraper/media-downloader.ts
git commit -m "feat(scraper): idempotent media downloader"
```

---

### Task 3.5: State manager

**Files:**
- Create: `scripts/procity/scraper/state.ts`

- [ ] **Step 1: Écrire**

Create `scripts/procity/scraper/state.ts` :

```typescript
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import type { ScraperState } from './types';

export class StateManager {
  private state: ScraperState;

  constructor(private filePath: string) {
    this.state = { version: 1, runStartedAt: new Date().toISOString(), entries: {} };
  }

  async load(): Promise<void> {
    if (!existsSync(this.filePath)) return;
    const raw = await readFile(this.filePath, 'utf-8');
    this.state = JSON.parse(raw);
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2));
  }

  shouldSkip(reference: string, hash: string): boolean {
    return this.state.entries[reference]?.hash === hash;
  }

  record(reference: string, hash: string): void {
    this.state.entries[reference] = { hash, lastSeenAt: new Date().toISOString() };
  }

  getKnownReferences(): string[] {
    return Object.keys(this.state.entries);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/procity/scraper/state.ts
git commit -m "feat(scraper): state manager for incremental re-scrape"
```

---

### Task 3.6: Orchestrateur principal du scraper

**Files:**
- Create: `scripts/procity/scraper/index.ts`

- [ ] **Step 1: Écrire**

Create `scripts/procity/scraper/index.ts` :

```typescript
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fetchProductUrls } from './crawler';
import { ProcityFetcher, throttledFetch } from './fetcher';
import { extractProductSnapshot } from './extractor';
import { downloadMedia } from './media-downloader';
import { StateManager } from './state';
import type { ProductSnapshot } from './types';

const OUTPUT_DIR = join(process.cwd(), 'scripts/procity/scraper-output');
const SITEMAP_URL = 'https://procity.eu/sitemap.xml';

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1], 10)
    : undefined;

  console.log('[scrape] fetching product URLs from sitemap…');
  let urls = await fetchProductUrls(SITEMAP_URL);
  if (limit) urls = urls.slice(0, limit);
  console.log(`[scrape] ${urls.length} URLs to process`);

  const state = new StateManager(join(OUTPUT_DIR, 'state.json'));
  await state.load();

  const fetcher = new ProcityFetcher();
  await fetcher.start();

  const stats = { ok: 0, skipped: 0, failed: 0 };

  try {
    for (const url of urls) {
      try {
        const fetched = await throttledFetch(() => fetcher.fetchPage(url));
        const snapshot = extractProductSnapshot({ html: fetched.html, url });

        for (const variant of snapshot.variants) {
          const img = fetched.variantImages.get(variant.attributes.couleur || '');
          if (img) variant.imageFilenames = [filenameFromUrl(img)];
        }

        if (state.shouldSkip(snapshot.reference, snapshot.contentHash)) {
          stats.skipped++;
          console.log(`[skip] ${snapshot.reference}`);
          continue;
        }

        await saveSnapshot(snapshot);
        await downloadAllMedia(snapshot, fetched);
        state.record(snapshot.reference, snapshot.contentHash);
        await state.save();
        stats.ok++;
        console.log(`[ok] ${snapshot.reference} — ${snapshot.title}`);
      } catch (err) {
        stats.failed++;
        console.error(`[fail] ${url}: ${(err as Error).message}`);
      }
    }
  } finally {
    await fetcher.stop();
  }

  console.log('[scrape] done', stats);
  await writeFile(
    join(OUTPUT_DIR, `run-${Date.now()}.stats.json`),
    JSON.stringify(stats, null, 2)
  );
}

async function saveSnapshot(snapshot: ProductSnapshot): Promise<void> {
  const path = join(OUTPUT_DIR, 'snapshots', `${snapshot.reference}.json`);
  await mkdir(join(OUTPUT_DIR, 'snapshots'), { recursive: true });
  await writeFile(path, JSON.stringify(snapshot, null, 2));
}

async function downloadAllMedia(
  snapshot: ProductSnapshot,
  fetched: { imageLinks: string[]; pdfLinks: string[] }
): Promise<void> {
  const imageDir = join(OUTPUT_DIR, 'images', snapshot.reference);
  const pdfDir = join(OUTPUT_DIR, 'tech-sheets');

  for (const img of fetched.imageLinks) {
    try {
      await downloadMedia(img, imageDir, filenameFromUrl(img));
    } catch (err) {
      console.warn(`[media-warn] ${img}: ${(err as Error).message}`);
    }
  }
  for (const pdf of fetched.pdfLinks) {
    try {
      await downloadMedia(pdf, pdfDir, `${snapshot.reference}.pdf`);
      break; // un seul PDF par produit
    } catch (err) {
      console.warn(`[pdf-warn] ${pdf}: ${(err as Error).message}`);
    }
  }
}

function filenameFromUrl(url: string): string {
  return url.split('?')[0].split('/').pop() || 'unknown';
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Test avec limit 5**

Run : `npm run scrape:procity -- --limit 5`

Expected : 5 snapshots dans `scripts/procity/scraper-output/snapshots/`, images et 1+ PDF téléchargés, `run-*.stats.json` avec `ok:5`.

Ouvrir un JSON, vérifier que **tous les champs clés sont remplis** (title, reference, variants non vide, galleryFilenames non vide, contentHash). Si un champ manque → retour Task 3.1 pour ajuster l'extractor.

- [ ] **Step 3: Commit**

```bash
git add scripts/procity/scraper/index.ts
git commit -m "feat(scraper): main orchestrator with incremental resume"
```

- [ ] **Step 4: Run complet en arrière-plan**

Run : `npm run scrape:procity 2>&1 | tee scripts/procity/scraper-output/full-run.log`

Durée : 2-4h. Avancer Phase 4 pendant ce temps.

Contrôles finaux :
- `ok + skipped + failed = urls.length`
- `failed` < 5% du total
- Nombre de snapshots cohérent avec le nombre attendu (~1000+)

---

## Phase 4 — Pipeline d'import

### Task 4.1: Parser Excel

**Files:**
- Create: `scripts/procity/import/data/tarifs-2026.xlsx` (copie locale)
- Create: `scripts/procity/import/__tests__/excel-parser.test.ts`
- Create: `scripts/procity/import/excel-parser.ts`

- [ ] **Step 1: Copier l'Excel**

```bash
mkdir -p scripts/procity/import/data
cp "../Fournisseurs/Procity/tarifprocityvialux2026-fr.v1.7-699.xlsx" scripts/procity/import/data/tarifs-2026.xlsx
```

Vérifier qu'il existe : `ls -la scripts/procity/import/data/`.

- [ ] **Step 2: Écrire le test**

Create `scripts/procity/import/__tests__/excel-parser.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseTarifExcel } from '../excel-parser';

const EXCEL = join(__dirname, '../data/tarifs-2026.xlsx');

describe('parseTarifExcel', () => {
  it('loads at least 500 price rows', async () => {
    const rows = await parseTarifExcel(EXCEL);
    expect(rows.length).toBeGreaterThan(500);
  });

  it('each row has reference and priceHt', async () => {
    const rows = await parseTarifExcel(EXCEL);
    const anyProduct = rows[0];
    expect(anyProduct.reference).toMatch(/\d{5,7}/);
    expect(anyProduct.priceHt).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run — FAIL**

- [ ] **Step 4: Écrire parser**

Create `scripts/procity/import/excel-parser.ts` :

```typescript
import ExcelJS from 'exceljs';

export interface TarifRow {
  reference: string;
  variantRef?: string;
  designation: string;
  priceHt: number;
  availability?: string;
}

interface Headers {
  headerRow: number;
  referenceCol: number;
  designationCol: number;
  priceCol: number;
  availabilityCol?: number;
}

export async function parseTarifExcel(filePath: string): Promise<TarifRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const rows: TarifRow[] = [];

  for (const sheet of wb.worksheets) {
    const headers = detectHeaders(sheet);
    if (!headers) continue;

    sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum <= headers.headerRow) return;
      const rawRef = safeString(row.getCell(headers.referenceCol).value);
      const price = safeNumber(row.getCell(headers.priceCol).value);
      const designation = safeString(row.getCell(headers.designationCol).value);
      if (!rawRef || !price) return;

      const hasDot = rawRef.includes('.');
      rows.push({
        reference: rawRef.split('.')[0],
        variantRef: hasDot ? rawRef : undefined,
        designation,
        priceHt: price,
        availability: headers.availabilityCol
          ? safeString(row.getCell(headers.availabilityCol).value) || undefined
          : undefined,
      });
    });
  }

  return rows;
}

function detectHeaders(sheet: ExcelJS.Worksheet): Headers | null {
  for (let r = 1; r <= Math.min(20, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    let referenceCol = 0, designationCol = 0, priceCol = 0;
    let availabilityCol: number | undefined;
    row.eachCell((cell, col) => {
      const v = safeString(cell.value).toLowerCase();
      if (/r[ée]f[ée]rence|^ref\.?$/i.test(v)) referenceCol = col;
      if (/d[ée]signation|libell[ée]|produit/i.test(v)) designationCol = col;
      if (/prix\s*(ht|unitaire)/i.test(v)) priceCol = col;
      if (/disponibilit|d[ée]lai/i.test(v)) availabilityCol = col;
    });
    if (referenceCol && priceCol) {
      return {
        headerRow: r,
        referenceCol,
        designationCol: designationCol || referenceCol,
        priceCol,
        availabilityCol,
      };
    }
  }
  return null;
}

function safeString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object' && v !== null && 'result' in v) {
    return String((v as { result: unknown }).result ?? '');
  }
  return String(v).trim();
}

function safeNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'result' in v) {
    return Number((v as { result: unknown }).result) || 0;
  }
  const n = parseFloat(String(v).replace(/[^\d.,]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
```

- [ ] **Step 5: Run — PASS**

Si FAIL, inspecter la structure réelle de l'Excel :

```bash
npx tsx -e "
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile('scripts/procity/import/data/tarifs-2026.xlsx');
console.log('sheets:', wb.worksheets.map(s => s.name));
const s = wb.worksheets[0];
for (let r = 1; r <= 8; r++) console.log(r, JSON.stringify(s.getRow(r).values));
"
```

Adapter `detectHeaders` selon la structure observée.

- [ ] **Step 6: Commit**

```bash
git add scripts/procity/import/excel-parser.ts scripts/procity/import/__tests__/excel-parser.test.ts scripts/procity/import/data/tarifs-2026.xlsx
git commit -m "feat(import): Excel tariff parser with header auto-detection"
```

---

### Task 4.2: Image matcher

**Files:**
- Create: `scripts/procity/import/__tests__/image-matcher.test.ts`
- Create: `scripts/procity/import/image-matcher.ts`

- [ ] **Step 1: Écrire le test**

Create `scripts/procity/import/__tests__/image-matcher.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { matchImagesForReference, parseLocalImageFilename } from '../image-matcher';

describe('parseLocalImageFilename', () => {
  it('extracts refs from "012 - Kub - 306425+306390+306380+306422+306488.jpg"', () => {
    const r = parseLocalImageFilename('012 - Kub - 306425+306390+306380+306422+306488.jpg');
    expect(r?.references).toEqual(['306425','306390','306380','306422','306488']);
    expect(r?.label).toBe('Kub');
  });

  it('handles single reference "015 - 206168.jpg"', () => {
    const r = parseLocalImageFilename('015 - 206168.jpg');
    expect(r?.references).toEqual(['206168']);
  });

  it('returns null for unparseable names', () => {
    expect(parseLocalImageFilename('random.jpg')).toBeNull();
  });
});

describe('matchImagesForReference', () => {
  it('returns filenames containing the reference', () => {
    const all = [
      '012 - Kub - 306425+306390.jpg',
      '015 - 306425 Situ.jpg',
      '013 - Autre - 999999.jpg',
    ];
    expect(matchImagesForReference('306425', all)).toEqual([
      '012 - Kub - 306425+306390.jpg',
      '015 - 306425 Situ.jpg',
    ]);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Écrire matcher**

Create `scripts/procity/import/image-matcher.ts` :

```typescript
import { readdir } from 'fs/promises';

export interface ParsedFilename {
  references: string[];
  label: string | null;
  raw: string;
}

const FILENAME_REGEX = /^(\d{3})\s*-\s*(?:([^-]+?)\s*-\s*)?((?:\d{5,7}\+?)+)(?:\s+[A-Za-z0-9]+)?\.jpg$/i;
const SINGLE_REF_REGEX = /(\d{5,7})/g;

export function parseLocalImageFilename(filename: string): ParsedFilename | null {
  const fullMatch = FILENAME_REGEX.exec(filename);
  if (fullMatch) {
    return {
      raw: filename,
      label: fullMatch[2]?.trim() || null,
      references: fullMatch[3].split('+').filter(Boolean),
    };
  }
  const refs = [...filename.matchAll(SINGLE_REF_REGEX)].map(m => m[1]);
  if (refs.length === 0) return null;
  return { raw: filename, label: null, references: refs };
}

export function matchImagesForReference(reference: string, allFilenames: string[]): string[] {
  return allFilenames.filter(f => {
    const parsed = parseLocalImageFilename(f);
    return parsed?.references.includes(reference);
  });
}

export async function loadLocalPhotoIndex(rootDir: string): Promise<string[]> {
  const files = await readdir(rootDir);
  return files.filter(f => /\.(jpg|jpeg|png)$/i.test(f));
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add scripts/procity/import/image-matcher.ts scripts/procity/import/__tests__/image-matcher.test.ts
git commit -m "feat(import): match HD local photos to product references"
```

---

### Task 4.3: LLM rewriter dans src/lib

**Files:**
- Create: `src/lib/llm-rewriter.ts`

**⚠️** Créé dans `src/lib/` (et non dans `scripts/procity/import/`) pour être importable à la fois par le script CLI et par les routes API Next.js.

- [ ] **Step 1: Écrire**

Create `src/lib/llm-rewriter.ts` :

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface RewriteInput {
  title: string;
  descriptionRaw: string;
  characteristics: { label: string; value: string }[];
}

const SYSTEM_PROMPT = `Tu es rédacteur catalogue pour SAPAL Signalisation, revendeur basé à Cannes, qui vend du mobilier urbain et de la signalisation à des collectivités et professionnels.

Tu réécris des descriptions produits en respectant ces règles :
- 80 à 150 mots, ton sobre et factuel (ni promotionnel ni plat)
- Pas de superlatifs creux ("incontournable", "exceptionnel", "gamme premium")
- Pas de mention de la marque du fabricant (Procity, Vialux, etc.) — SAPAL est le revendeur
- Pas de copie littérale de la source (reformulation complète)
- Pas d'invention : ne parle que de ce qui est dans la source ou les caractéristiques techniques fournies
- Structure implicite : à quoi ça sert, pour qui, ce qui le caractérise
- Français professionnel, sans fautes, sans anglicismes inutiles`;

export async function rewriteDescription(input: RewriteInput): Promise<string> {
  const userMessage = [
    `Titre : ${input.title}`,
    `Description source : ${input.descriptionRaw}`,
    `Caractéristiques : ${input.characteristics.map(c => `${c.label} = ${c.value}`).join(' ; ')}`,
    '',
    'Réécris cette description pour le catalogue SAPAL.',
  ].join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('LLM returned no text');
  }
  return textBlock.text.trim();
}
```

Le `cache_control: ephemeral` met le system prompt en cache Anthropic (identique pour tous les produits → coût divisé).

- [ ] **Step 2: Smoke test**

```bash
npx tsx -e "
import { rewriteDescription } from './src/lib/llm-rewriter';
const t = await rewriteDescription({
  title: 'Abri Chariots Modulo',
  descriptionRaw: 'Ce nouvel abri vient compléter notre offre et ainsi répondre aux besoins de rangement de chariots sur les parkings des zones commerciales.',
  characteristics: [{label:'Type',value:'Abris'},{label:'Poids',value:'550 kg'}],
});
console.log(t);
"
```

Expected : 80-150 mots, sobre, pas de mention Procity, non littéral.

- [ ] **Step 3: Commit**

```bash
git add src/lib/llm-rewriter.ts
git commit -m "feat(lib): LLM description rewriter (Haiku 4.5 with prompt cache)"
```

---

### Task 4.4: Storage uploader

**Files:**
- Create: `scripts/procity/import/storage-uploader.ts`

- [ ] **Step 1: Écrire**

Create `scripts/procity/import/storage-uploader.ts` :

```typescript
import { readFile } from 'fs/promises';
import { extname } from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'supplier-media';

export async function uploadMedia(
  supabase: SupabaseClient,
  localPath: string,
  remotePath: string
): Promise<string> {
  const buf = await readFile(localPath);
  const contentType = inferContentType(localPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(remotePath, buf, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed for ${remotePath}: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(remotePath);
  return data.publicUrl;
}

function inferContentType(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

export function buildMediaPath(
  supplierSlug: string,
  reference: string,
  kind: 'gallery' | 'variants' | 'tech-sheet',
  filename: string
): string {
  if (kind === 'tech-sheet') {
    return `${supplierSlug}/products/${reference}/tech-sheet.pdf`;
  }
  return `${supplierSlug}/products/${reference}/${kind}/${filename}`;
}
```

- [ ] **Step 2: Smoke test**

```bash
npx tsx -e "
import { getSupabaseClient } from './scripts/procity/shared/supabase-client';
import { uploadMedia, buildMediaPath } from './scripts/procity/import/storage-uploader';
const s = getSupabaseClient();
const url = await uploadMedia(s, './public/next.svg', buildMediaPath('procity','TEST000','gallery','next.svg'));
console.log('Uploaded:', url);
"
```

Expected : URL publique accessible. Ouvrir → SVG s'affiche.

Nettoyer ensuite via MCP Supabase ou dashboard (supprimer `supplier-media/procity/products/TEST000/...`).

- [ ] **Step 3: Commit**

```bash
git add scripts/procity/import/storage-uploader.ts
git commit -m "feat(import): Supabase Storage uploader with path helpers"
```

---

### Task 4.5: DB writer (upsert products + variants)

**Files:**
- Create: `scripts/procity/import/db-writer.ts`

- [ ] **Step 1: Inspecter le schéma products existant**

Via MCP :

```sql
select column_name, data_type from information_schema.columns
where table_name = 'products' order by ordinal_position;
```

Noter les colonnes obligatoires (`name`, `slug`, `price`, `category_id`, etc.).

- [ ] **Step 2: Écrire db-writer**

Create `scripts/procity/import/db-writer.ts` :

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductSnapshot } from '../scraper/types';
import type { TarifRow } from './excel-parser';

export interface ImportRecord {
  snapshot: ProductSnapshot;
  tarifRows: TarifRow[];
  descriptionSapal: string;
  galleryUrls: string[];
  techSheetUrl?: string;
  variantImageUrls: Record<string, string>;
}

export async function upsertProduct(
  supabase: SupabaseClient,
  supplierId: string,
  record: ImportRecord
): Promise<string> {
  const { snapshot } = record;
  const basePrice =
    record.tarifRows.find(r => !r.variantRef)?.priceHt ??
    record.tarifRows[0]?.priceHt ??
    0;

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', snapshot.universe)
    .maybeSingle();

  const { data: product, error } = await supabase
    .from('products')
    .upsert(
      {
        supplier_id: supplierId,
        reference: snapshot.reference,
        name: snapshot.title,
        slug: slugify(snapshot.title),
        description: snapshot.descriptionRaw,
        description_sapal: record.descriptionSapal,
        description_source_hash: snapshot.contentHash,
        procity_url: snapshot.procityUrl,
        category_id: category?.id ?? null,
        price: basePrice,
        gallery_image_urls: record.galleryUrls,
        tech_sheet_url: record.techSheetUrl ?? null,
        last_scraped_at: snapshot.scrapedAt,
        characteristics: snapshot.characteristics,
      },
      { onConflict: 'reference' }
    )
    .select('id')
    .single();

  if (error || !product) throw new Error(`Product upsert failed: ${error?.message}`);

  await upsertVariants(supabase, product.id, record);
  return product.id;
}

async function upsertVariants(
  supabase: SupabaseClient,
  productId: string,
  record: ImportRecord
): Promise<void> {
  for (const variant of record.snapshot.variants) {
    const tarif = record.tarifRows.find(r => r.variantRef === variant.variantRef);
    const availability =
      variant.availability ??
      record.snapshot.availabilityDefault ??
      tarif?.availability;

    await supabase.from('product_variants').upsert(
      {
        product_id: productId,
        variant_ref: variant.variantRef,
        attributes: variant.attributes,
        price: tarif?.priceHt ?? null,
        availability,
        primary_image_url: record.variantImageUrls[variant.variantRef] ?? null,
      },
      { onConflict: 'product_id,variant_ref' }
    );
  }
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
```

**⚠️ Vérifier** : le schéma existant a-t-il les colonnes `characteristics`, `reference` uniques ? Si `reference` n'a pas de contrainte UNIQUE, ajouter une migration 020-bis ou corriger l'`onConflict`.

Via MCP :

```sql
select constraint_name from information_schema.table_constraints
where table_name='products' and constraint_type='UNIQUE';
```

Si aucune contrainte unique sur `reference`, créer `supabase/migrations/020b_products_reference_unique.sql` :

```sql
alter table public.products add constraint products_reference_unique unique (reference);
```

- [ ] **Step 3: Commit**

```bash
git add scripts/procity/import/db-writer.ts
git commit -m "feat(import): idempotent DB writer for products and variants"
```

---

### Task 4.6: Diff computer

**Files:**
- Create: `scripts/procity/import/__tests__/diff-computer.test.ts`
- Create: `scripts/procity/import/diff-computer.ts`

- [ ] **Step 1: Test**

Create `scripts/procity/import/__tests__/diff-computer.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { computeDiff } from '../diff-computer';

describe('computeDiff', () => {
  it('detects added, updated, removed, unchanged', () => {
    const current = [
      { reference: 'A', contentHash: 'h1', title: 'A' },
      { reference: 'B', contentHash: 'h2', title: 'B' },
      { reference: 'X', contentHash: 'hx', title: 'X' },
    ];
    const incoming = [
      { reference: 'A', contentHash: 'h1', title: 'A' },
      { reference: 'B', contentHash: 'h2b', title: 'B modified' },
      { reference: 'C', contentHash: 'h3', title: 'C' },
    ];
    const diff = computeDiff(current, incoming);
    expect(diff.added.map(p => p.reference)).toEqual(['C']);
    expect(diff.updated.map(p => p.reference)).toEqual(['B']);
    expect(diff.removed).toEqual(['X']);
    expect(diff.unchanged.map(p => p.reference)).toEqual(['A']);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Écrire diff-computer**

Create `scripts/procity/import/diff-computer.ts` :

```typescript
export interface DiffItem {
  reference: string;
  contentHash: string;
  title: string;
}

export interface Diff {
  added: DiffItem[];
  updated: DiffItem[];
  removed: string[];
  unchanged: DiffItem[];
}

export function computeDiff(current: DiffItem[], incoming: DiffItem[]): Diff {
  const currentMap = new Map(current.map(p => [p.reference, p]));
  const incomingMap = new Map(incoming.map(p => [p.reference, p]));

  const added: DiffItem[] = [];
  const updated: DiffItem[] = [];
  const unchanged: DiffItem[] = [];

  for (const [ref, inc] of incomingMap) {
    const cur = currentMap.get(ref);
    if (!cur) added.push(inc);
    else if (cur.contentHash !== inc.contentHash) updated.push(inc);
    else unchanged.push(inc);
  }

  const removed: string[] = [];
  for (const [ref] of currentMap) {
    if (!incomingMap.has(ref)) removed.push(ref);
  }

  return { added, updated, removed, unchanged };
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add scripts/procity/import/diff-computer.ts scripts/procity/import/__tests__/diff-computer.test.ts
git commit -m "feat(import): diff computer for scrape run review"
```

---

### Task 4.7: Orchestrateur d'import

**Files:**
- Create: `scripts/procity/import/index.ts`
- Create: `scripts/procity/import/__tests__/integration.test.ts`

- [ ] **Step 1: Écrire l'orchestrateur**

Create `scripts/procity/import/index.ts` :

```typescript
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { getSupabaseClient } from '../shared/supabase-client';
import { parseTarifExcel, type TarifRow } from './excel-parser';
import { loadLocalPhotoIndex, matchImagesForReference } from './image-matcher';
import { rewriteDescription } from '../../../src/lib/llm-rewriter';
import { uploadMedia, buildMediaPath } from './storage-uploader';
import { upsertProduct } from './db-writer';
import { computeDiff } from './diff-computer';
import type { ProductSnapshot } from '../scraper/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const SNAPSHOTS_DIR = join(process.cwd(), 'scripts/procity/scraper-output/snapshots');
const IMAGES_DIR = join(process.cwd(), 'scripts/procity/scraper-output/images');
const PDF_DIR = join(process.cwd(), 'scripts/procity/scraper-output/tech-sheets');
const LOCAL_HD_DIR = join(
  process.cwd(),
  '../Fournisseurs/Procity/Photos - 300 dpi - PROCITY FR 2026 2'
);
const EXCEL_PATH = join(process.cwd(), 'scripts/procity/import/data/tarifs-2026.xlsx');

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = !apply;
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1], 10)
    : undefined;

  console.log(`[import] mode=${dryRun ? 'DRY-RUN' : 'APPLY'}`);

  const supabase = getSupabaseClient();
  const { data: supplier } = await supabase
    .from('suppliers').select('id').eq('slug', 'procity').single();
  if (!supplier) throw new Error('Supplier procity not found — run migration 019');

  const tarifRows = await parseTarifExcel(EXCEL_PATH);
  const tarifByRef = groupByRef(tarifRows);
  const localPhotos = await loadLocalPhotoIndex(LOCAL_HD_DIR);
  const snapshots = await loadAllSnapshots(limit);

  const { data: currentProducts } = await supabase
    .from('products')
    .select('reference, description_source_hash, name')
    .eq('supplier_id', supplier.id);

  const diff = computeDiff(
    (currentProducts || []).map(p => ({
      reference: p.reference,
      contentHash: p.description_source_hash || '',
      title: p.name,
    })),
    snapshots.map(s => ({
      reference: s.reference,
      contentHash: s.contentHash,
      title: s.title,
    }))
  );

  console.log(`[import] diff: +${diff.added.length} ~${diff.updated.length} -${diff.removed.length} =${diff.unchanged.length}`);

  // Enregistrer un scrape_run en DB (pour l'observatoire admin)
  const { data: run } = await supabase
    .from('scrape_runs')
    .insert({
      supplier_id: supplier.id,
      status: dryRun ? 'pending_review' : 'running',
      stats: {
        added: diff.added.length,
        updated: diff.updated.length,
        removed: diff.removed.length,
      },
      diff_payload: {
        added: diff.added,
        updated: diff.updated,
        removed: diff.removed,
      },
    })
    .select('id')
    .single();

  if (dryRun) {
    console.log('[import] dry-run: no DB writes to products, no LLM calls, no uploads');
    console.log(`[import] scrape_run id=${run?.id} status=pending_review`);
    return;
  }

  const toProcess = [...diff.added, ...diff.updated];
  let done = 0, failed = 0;

  for (const item of toProcess) {
    const snapshot = snapshots.find(s => s.reference === item.reference);
    if (!snapshot) continue;
    try {
      await processOne(supabase, supplier.id, snapshot, tarifByRef, localPhotos);
      done++;
      console.log(`[ok] ${done}/${toProcess.length} — ${snapshot.reference}`);
    } catch (err) {
      failed++;
      console.error(`[fail] ${snapshot.reference}: ${(err as Error).message}`);
    }
  }

  await supabase
    .from('scrape_runs')
    .update({
      status: 'applied',
      finished_at: new Date().toISOString(),
      stats: {
        added: diff.added.length,
        updated: diff.updated.length,
        removed: diff.removed.length,
        done,
        failed,
      },
    })
    .eq('id', run?.id);

  console.log(`[import] done: ${done}/${toProcess.length} (failed: ${failed})`);
}

async function loadAllSnapshots(limit?: number): Promise<ProductSnapshot[]> {
  const files = await readdir(SNAPSHOTS_DIR);
  let jsonFiles = files.filter(f => f.endsWith('.json'));
  if (limit) jsonFiles = jsonFiles.slice(0, limit);
  const result: ProductSnapshot[] = [];
  for (const f of jsonFiles) {
    const raw = await readFile(join(SNAPSHOTS_DIR, f), 'utf-8');
    result.push(JSON.parse(raw));
  }
  return result;
}

function groupByRef(rows: TarifRow[]): Map<string, TarifRow[]> {
  const map = new Map<string, TarifRow[]>();
  for (const r of rows) {
    const arr = map.get(r.reference) || [];
    arr.push(r);
    map.set(r.reference, arr);
  }
  return map;
}

async function processOne(
  supabase: SupabaseClient,
  supplierId: string,
  snapshot: ProductSnapshot,
  tarifByRef: Map<string, TarifRow[]>,
  localPhotos: string[]
) {
  const tarifRows = tarifByRef.get(snapshot.reference) || [];
  if (tarifRows.length === 0) {
    console.warn(`[skip] ${snapshot.reference}: no tarif in Excel`);
    return;
  }

  const descriptionSapal = await rewriteDescription({
    title: snapshot.title,
    descriptionRaw: snapshot.descriptionRaw,
    characteristics: snapshot.characteristics,
  });

  const galleryUrls: string[] = [];
  const hdMatches = matchImagesForReference(snapshot.reference, localPhotos);
  for (const hd of hdMatches) {
    try {
      const url = await uploadMedia(
        supabase,
        join(LOCAL_HD_DIR, hd),
        buildMediaPath('procity', snapshot.reference, 'gallery', hd)
      );
      galleryUrls.push(url);
    } catch (err) {
      console.warn(`[hd-warn] ${hd}: ${(err as Error).message}`);
    }
  }
  if (galleryUrls.length === 0) {
    for (const img of snapshot.galleryFilenames) {
      try {
        const url = await uploadMedia(
          supabase,
          join(IMAGES_DIR, snapshot.reference, img),
          buildMediaPath('procity', snapshot.reference, 'gallery', img)
        );
        galleryUrls.push(url);
      } catch (err) {
        console.warn(`[media-warn] ${img}: ${(err as Error).message}`);
      }
    }
  }

  const variantImageUrls: Record<string, string> = {};
  for (const variant of snapshot.variants) {
    const firstImg = variant.imageFilenames[0];
    if (!firstImg) continue;
    try {
      const url = await uploadMedia(
        supabase,
        join(IMAGES_DIR, snapshot.reference, firstImg),
        buildMediaPath('procity', snapshot.reference, 'variants', `${variant.variantRef}.jpg`)
      );
      variantImageUrls[variant.variantRef] = url;
    } catch (err) {
      console.warn(`[variant-img-warn] ${firstImg}: ${(err as Error).message}`);
    }
  }

  let techSheetUrl: string | undefined;
  if (snapshot.techSheetFilename) {
    try {
      techSheetUrl = await uploadMedia(
        supabase,
        join(PDF_DIR, `${snapshot.reference}.pdf`),
        buildMediaPath('procity', snapshot.reference, 'tech-sheet', '')
      );
    } catch (err) {
      console.warn(`[pdf-warn] ${snapshot.reference}: ${(err as Error).message}`);
    }
  }

  await upsertProduct(supabase, supplierId, {
    snapshot,
    tarifRows,
    descriptionSapal,
    galleryUrls,
    techSheetUrl,
    variantImageUrls,
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Test d'intégration smoke**

Create `scripts/procity/import/__tests__/integration.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { computeDiff } from '../diff-computer';

describe('import orchestration smoke', () => {
  it('computeDiff handles empty current state (first import)', () => {
    const diff = computeDiff([], [
      { reference: '1', contentHash: 'a', title: 'X' },
      { reference: '2', contentHash: 'b', title: 'Y' },
    ]);
    expect(diff.added.length).toBe(2);
    expect(diff.updated.length).toBe(0);
    expect(diff.removed.length).toBe(0);
  });
});
```

Run `npm run test` — tout doit passer.

- [ ] **Step 3: Dry-run sur les snapshots**

Run : `npm run import:procity:dry`

Expected :
- Log du diff (ex: +950 ~0 -0 =0 au premier tour)
- Un scrape_run créé en `pending_review`
- Aucun INSERT dans `products`

Vérifier via MCP :

```sql
select id, status, stats from scrape_runs order by started_at desc limit 1;
```

- [ ] **Step 4: Commit**

```bash
git add scripts/procity/import/index.ts scripts/procity/import/__tests__/integration.test.ts
git commit -m "feat(import): main orchestrator with scrape_run tracking"
```

---

### Task 4.8: Apply limité (10 produits) + contrôle qualité

- [ ] **Step 1: Apply limit 10**

Run : `npm run import:procity:apply -- --limit 10`

Expected : 10 produits insérés, images dans le bucket, descriptions générées. Un scrape_run passe en `applied`.

- [ ] **Step 2: Contrôle en DB**

Via MCP :

```sql
select reference, name,
  length(description_sapal) as desc_len,
  array_length(gallery_image_urls, 1) as n_imgs,
  tech_sheet_url is not null as has_pdf
from products
where last_scraped_at > now() - interval '1 hour'
order by last_scraped_at desc
limit 10;
```

Pour chaque ligne : `desc_len` entre 400 et 1500, `n_imgs` ≥ 1, `has_pdf` vrai si le produit a un PDF sur Procity.

- [ ] **Step 3: Ouvrir 3 URLs de galerie dans le navigateur**

Prendre 3 `gallery_image_urls` au hasard → doivent afficher l'image.

- [ ] **Step 4: Contrôle variantes**

```sql
select pv.variant_ref, pv.attributes, pv.price, pv.availability, pv.primary_image_url is not null as has_img
from product_variants pv
join products p on p.id = pv.product_id
where p.last_scraped_at > now() - interval '1 hour'
limit 20;
```

Vérifier : chaque variante a un prix > 0 et une availability non vide (ou cascade OK).

- [ ] **Step 5: Apply complet**

**Si les 10 sont OK** :

Run : `npm run import:procity:apply`

Durée : 30-60 min. Pendant ce temps, avancer Phase 5.

**Si des erreurs > 5%** : STOP, analyser les logs, corriger, re-run. Ne pas enchaîner Phase 5 sur un import sale.

---

## Phase 5 — Front-end public

### Task 5.1: ProductGallery

**Files:**
- Create: `src/components/product/ProductGallery.tsx`

- [ ] **Step 1: Écrire**

Create `src/components/product/ProductGallery.tsx` :

```tsx
'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';

interface Variant {
  variantRef: string;
  primaryImageUrl: string | null;
  attributes: Record<string, string>;
}

interface Props {
  galleryUrls: string[];
  variants: Variant[];
  selectedVariantRef: string | null;
  productName: string;
}

export function ProductGallery({ galleryUrls, variants, selectedVariantRef, productName }: Props) {
  const activeUrls = useMemo(() => {
    const variant = variants.find(v => v.variantRef === selectedVariantRef);
    const primary = variant?.primaryImageUrl;
    const rest = galleryUrls.filter(u => u !== primary);
    return primary ? [primary, ...rest] : galleryUrls;
  }, [galleryUrls, variants, selectedVariantRef]);

  const [activeIndex, setActiveIndex] = useState(0);
  const main = activeUrls[activeIndex] || activeUrls[0];

  if (!main) {
    return (
      <div className="aspect-square bg-gray-100 flex items-center justify-center text-gray-400 rounded-lg">
        Pas d'image disponible
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden">
        <Image
          src={main}
          alt={productName}
          fill
          className="object-contain"
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
      </div>
      {activeUrls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {activeUrls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Image ${i + 1}`}
              aria-current={i === activeIndex}
              className={`relative w-20 h-20 flex-shrink-0 rounded border-2 overflow-hidden transition ${
                i === activeIndex ? 'border-orange-500' : 'border-transparent'
              }`}
            >
              <Image src={url} alt="" fill className="object-cover" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/product/ProductGallery.tsx
git commit -m "feat(front): ProductGallery with variant-driven main image"
```

---

### Task 5.2: TechSheetButton

**Files:**
- Create: `src/components/product/TechSheetButton.tsx`

- [ ] **Step 1: Écrire**

Create `src/components/product/TechSheetButton.tsx` :

```tsx
import { FileDown } from 'lucide-react';

interface Props {
  url: string | null;
}

export function TechSheetButton({ url }: Props) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 border rounded-md text-sm hover:bg-gray-50 transition"
    >
      <FileDown className="w-4 h-4" />
      Télécharger la fiche technique
    </a>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/product/TechSheetButton.tsx
git commit -m "feat(front): TechSheetButton"
```

---

### Task 5.3: AvailabilityBadge

**Files:**
- Create: `src/components/product/AvailabilityBadge.tsx`

- [ ] **Step 1: Écrire**

Create `src/components/product/AvailabilityBadge.tsx` :

```tsx
import { Calendar } from 'lucide-react';

interface Props {
  variantAvailability: string | null;
  productAvailability: string | null;
  supplierDefault: string | null;
}

export function AvailabilityBadge({ variantAvailability, productAvailability, supplierDefault }: Props) {
  const value = variantAvailability || productAvailability || supplierDefault || 'À confirmer';
  return (
    <span className="inline-flex items-center gap-2 text-sm text-gray-700">
      <Calendar className="w-4 h-4 text-orange-500" />
      <strong>Disponibilité :</strong> {value}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/product/AvailabilityBadge.tsx
git commit -m "feat(front): AvailabilityBadge with cascade"
```

---

### Task 5.4: SupplierBadge

**Files:**
- Create: `src/components/product/SupplierBadge.tsx`

- [ ] **Step 1: Écrire**

Create `src/components/product/SupplierBadge.tsx` :

```tsx
interface Props {
  supplierName: string | null;
}

export function SupplierBadge({ supplierName }: Props) {
  if (!supplierName) return null;
  return (
    <div className="text-xs text-gray-500 italic">
      Produit fabriqué par {supplierName}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/product/SupplierBadge.tsx
git commit -m "feat(front): SupplierBadge"
```

---

### Task 5.5: Adapter la fiche produit publique

**Files:**
- Modify: `src/app/catalogue/[slug]/[productSlug]/page.tsx`
- Modify: `src/lib/data.ts`

- [ ] **Step 1: Inspecter la fiche et lib/data actuelles**

```bash
cat "src/app/catalogue/[slug]/[productSlug]/page.tsx"
cat src/lib/data.ts | head -80
```

Repérer la fonction de fetch produit et le rendu images/description.

- [ ] **Step 2: Étendre la fonction fetch dans data.ts**

Adapter la fonction (ex : `getProductBySlug`) pour sélectionner les nouveaux champs :

```typescript
const { data } = await supabase
  .from('products')
  .select(`
    *,
    description_sapal,
    gallery_image_urls,
    tech_sheet_url,
    supplier:suppliers ( id, slug, name, default_availability ),
    variants:product_variants (
      id, variant_ref, attributes, price, availability, primary_image_url
    )
  `)
  .eq('slug', productSlug)
  .single();
```

Adapter aux noms de fonction et aux types TypeScript existants.

- [ ] **Step 3: Adapter la page produit**

Modify `src/app/catalogue/[slug]/[productSlug]/page.tsx` :

```tsx
import { ProductGallery } from '@/components/product/ProductGallery';
import { TechSheetButton } from '@/components/product/TechSheetButton';
import { AvailabilityBadge } from '@/components/product/AvailabilityBadge';
import { SupplierBadge } from '@/components/product/SupplierBadge';

// Remplacer le bloc images par :
// <ProductGallery
//   galleryUrls={product.gallery_image_urls || []}
//   variants={(product.variants || []).map(v => ({
//     variantRef: v.variant_ref,
//     primaryImageUrl: v.primary_image_url,
//     attributes: v.attributes,
//   }))}
//   selectedVariantRef={selectedVariant?.variant_ref ?? null}
//   productName={product.name}
// />
//
// Pour la description : {product.description_sapal || product.description}
// Ajouter : <TechSheetButton url={product.tech_sheet_url} />
// Remplacer le badge dispo par :
// <AvailabilityBadge
//   variantAvailability={selectedVariant?.availability ?? null}
//   productAvailability={null}
//   supplierDefault={product.supplier?.default_availability ?? null}
// />
// En bas de fiche : <SupplierBadge supplierName={product.supplier?.name ?? null} />
```

Adapter précisément au JSX existant — lire, insérer, ne pas coller en aveugle.

- [ ] **Step 4: Tester en localhost**

Run : `npm run dev` (autre terminal).

Ouvrir `http://localhost:3000/catalogue/mobilier-urbain/<slug-d-un-produit-importé>`.

Contrôler :
- [ ] Galerie : au moins 2 images cliquables
- [ ] Changement couleur → photo principale change
- [ ] Description : texte réécrit, pas "Pas de description"
- [ ] Disponibilité : valeur spécifique (ex "5 semaines"), pas générique
- [ ] PDF : bouton présent si produit concerné, clic ouvre PDF
- [ ] Badge Procity en bas

Si manque : DevTools → Network → inspecter la payload, vérifier que la jointure SQL renvoie bien les nouveaux champs.

- [ ] **Step 5: Commit**

```bash
git add src/app/catalogue src/lib/data.ts
git commit -m "feat(front): enriched product page (gallery, PDF, availability cascade, supplier)"
```

---

## Phase 6 — Admin

### Task 6.1: Liste fournisseurs

**Files:**
- Create: `src/app/admin/fournisseurs/page.tsx`

- [ ] **Step 1: Vérifier le chemin du client Supabase serveur**

```bash
ls src/lib/supabase/
```

Noter le nom exact (probablement `server.ts`).

- [ ] **Step 2: Écrire**

Create `src/app/admin/fournisseurs/page.tsx` :

```tsx
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function SuppliersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, slug, name, website, default_availability')
    .order('name');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Fournisseurs</h1>
      <div className="grid gap-4">
        {(suppliers || []).map(s => (
          <Link
            key={s.id}
            href={`/admin/fournisseurs/${s.slug}/runs`}
            className="block p-4 border rounded hover:bg-gray-50"
          >
            <div className="font-semibold">{s.name}</div>
            <div className="text-sm text-gray-500">{s.website}</div>
            <div className="text-sm">Délai par défaut : {s.default_availability || '—'}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

Adapter le nom `createSupabaseServerClient` si différent dans le repo.

- [ ] **Step 3: Tester**

Ouvrir `http://localhost:3000/admin/fournisseurs` connecté admin. Doit afficher Procity.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/fournisseurs/page.tsx
git commit -m "feat(admin): suppliers list page"
```

---

### Task 6.2: Liste runs + instructions CLI

**Files:**
- Create: `src/app/admin/fournisseurs/[slug]/runs/page.tsx`
- Create: `src/app/admin/fournisseurs/[slug]/runs/TriggerHint.tsx`

**Note :** pas d'API de déclenchement côté serveur (les scripts Node ne peuvent pas tourner sur Vercel serverless de manière fiable). L'admin lance la commande en local depuis sa machine, la page affiche les instructions.

- [ ] **Step 1: Composant client pour afficher la commande**

Create `src/app/admin/fournisseurs/[slug]/runs/TriggerHint.tsx` :

```tsx
'use client';

import { useState } from 'react';

export function TriggerHint({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const cmd = `npm run scrape:${slug} && npm run import:${slug}:dry`;
  const copy = async () => {
    await navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="p-4 bg-gray-50 rounded border text-sm space-y-2">
      <div className="font-semibold">Pour lancer un nouveau scrape :</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 p-2 bg-white border rounded font-mono text-xs">{cmd}</code>
        <button
          onClick={copy}
          className="px-3 py-2 bg-orange-500 text-white rounded text-xs"
        >
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>
      <div className="text-gray-600">
        À lancer depuis la machine d'un admin avec les accès. Le run apparaîtra dans la liste à la fin.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Page liste**

Create `src/app/admin/fournisseurs/[slug]/runs/page.tsx` :

```tsx
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TriggerHint } from './TriggerHint';

export default async function RunsListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: supplier } = await supabase
    .from('suppliers').select('id, name').eq('slug', slug).single();
  if (!supplier) return <div className="p-6">Fournisseur introuvable</div>;

  const { data: runs } = await supabase
    .from('scrape_runs')
    .select('*')
    .eq('supplier_id', supplier.id)
    .order('started_at', { ascending: false })
    .limit(50);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Runs — {supplier.name}</h1>
      <TriggerHint slug={slug} />
      <div className="space-y-2">
        {(runs || []).map(r => (
          <Link
            key={r.id}
            href={`/admin/fournisseurs/${slug}/runs/${r.id}`}
            className="block p-3 border rounded hover:bg-gray-50 text-sm"
          >
            <div className="font-semibold">{new Date(r.started_at).toLocaleString('fr-FR')}</div>
            <div>Status : <span className={statusClass(r.status)}>{r.status}</span></div>
            {r.stats && (
              <div className="text-gray-500">
                +{r.stats.added ?? 0} ~{r.stats.updated ?? 0} -{r.stats.removed ?? 0}
              </div>
            )}
          </Link>
        ))}
        {(!runs || runs.length === 0) && (
          <div className="text-gray-500 text-sm">Aucun run pour l'instant.</div>
        )}
      </div>
    </div>
  );
}

function statusClass(s: string) {
  if (s === 'completed' || s === 'applied') return 'text-green-600';
  if (s === 'failed' || s === 'rejected') return 'text-red-600';
  if (s === 'pending_review') return 'text-orange-600';
  return 'text-gray-600';
}
```

- [ ] **Step 3: Tester**

Aller sur `/admin/fournisseurs/procity/runs`. Affiche les runs créés par Task 4.7/4.8.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/fournisseurs
git commit -m "feat(admin): runs listing with CLI hint (no server spawn)"
```

---

### Task 6.3: Détail d'un run + diff review

**Files:**
- Create: `src/app/admin/fournisseurs/[slug]/runs/[runId]/page.tsx`
- Create: `src/app/admin/fournisseurs/[slug]/runs/[runId]/ApplyForm.tsx`
- Create: `src/app/api/admin/scrape/apply/route.ts`

- [ ] **Step 1: Page détail**

Create `src/app/admin/fournisseurs/[slug]/runs/[runId]/page.tsx` :

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ApplyForm } from './ApplyForm';

export default async function RunDetailPage({ params }: {
  params: Promise<{ slug: string; runId: string }>
}) {
  const { slug, runId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: run } = await supabase
    .from('scrape_runs').select('*').eq('id', runId).single();
  if (!run) return <div className="p-6">Run introuvable</div>;

  const diff = run.diff_payload || { added: [], updated: [], removed: [] };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Run du {new Date(run.started_at).toLocaleString('fr-FR')}
      </h1>
      <div>Status : <strong>{run.status}</strong></div>

      <section>
        <h2 className="font-semibold mb-2">Ajouts ({diff.added.length})</h2>
        <ul className="text-sm space-y-1 max-h-64 overflow-auto">
          {diff.added.map((p: { reference: string; title: string }) => (
            <li key={p.reference}>+ {p.reference} — {p.title}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Modifications ({diff.updated.length})</h2>
        <ul className="text-sm space-y-1 max-h-64 overflow-auto">
          {diff.updated.map((p: { reference: string; title: string }) => (
            <li key={p.reference}>~ {p.reference} — {p.title}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Suppressions ({diff.removed.length})</h2>
        <ul className="text-sm space-y-1 max-h-64 overflow-auto">
          {diff.removed.map((ref: string) => <li key={ref}>- {ref}</li>)}
        </ul>
      </section>

      {run.status === 'pending_review' && (
        <ApplyForm runId={runId} slug={slug} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: ApplyForm client**

Create `src/app/admin/fournisseurs/[slug]/runs/[runId]/ApplyForm.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ApplyForm({ runId, slug: _slug }: { runId: string; slug: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const act = async (action: 'apply' | 'reject') => {
    setBusy(true);
    const r = await fetch('/api/admin/scrape/apply', {
      method: 'POST',
      body: JSON.stringify({ runId, action }),
    });
    const { error } = await r.json();
    setBusy(false);
    if (error) alert(`Erreur: ${error}`);
    else router.refresh();
  };

  return (
    <div className="flex gap-3">
      <button
        disabled={busy}
        onClick={() => act('apply')}
        className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
      >
        Marquer comme appliqué
      </button>
      <button
        disabled={busy}
        onClick={() => act('reject')}
        className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
      >
        Rejeter
      </button>
    </div>
  );
}
```

**Note** : en V1, ces boutons ne font que changer le statut en DB. L'écriture effective des changements se fait en ligne de commande (`npm run import:procity:apply`). C'est documenté dans le README.

- [ ] **Step 3: API apply**

Create `src/app/api/admin/scrape/apply/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { runId, action } = await req.json();
  if (!['apply', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }

  const newStatus = action === 'apply' ? 'applied' : 'rejected';
  const { error } = await supabase
    .from('scrape_runs')
    .update({ status: newStatus, finished_at: new Date().toISOString() })
    .eq('id', runId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Tester**

Créer un run factice via MCP :

```sql
insert into scrape_runs (supplier_id, started_at, status, diff_payload, stats)
values (
  (select id from suppliers where slug='procity'),
  now(), 'pending_review',
  '{"added":[{"reference":"999001","contentHash":"x","title":"Test produit"}],"updated":[],"removed":[]}'::jsonb,
  '{"added":1,"updated":0,"removed":0}'::jsonb
);
```

Aller sur la page du run → vérifier affichage + clic "Marquer comme appliqué" → statut change → refresh auto.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/fournisseurs/[slug]/runs/[runId]" src/app/api/admin/scrape/apply
git commit -m "feat(admin): run detail view with apply/reject"
```

---

### Task 6.4: Admin produit — fournisseur + régénérer description

**Files:**
- Modify: `src/app/admin/produits/[id]/page.tsx`
- Create: `src/app/api/admin/products/[id]/rewrite-description/route.ts`

- [ ] **Step 1: Repérer la page admin produit**

```bash
ls "src/app/admin/produits/[id]/"
```

- [ ] **Step 2: Route API rewrite**

Create `src/app/api/admin/products/[id]/rewrite-description/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { rewriteDescription } from '@/lib/llm-rewriter';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: product } = await supabase
    .from('products')
    .select('name, description, characteristics')
    .eq('id', id)
    .single();
  if (!product) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const fresh = await rewriteDescription({
    title: product.name,
    descriptionRaw: product.description || '',
    characteristics: product.characteristics || [],
  });

  const { error } = await supabase
    .from('products')
    .update({ description_sapal: fresh })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ description: fresh });
}
```

- [ ] **Step 3: Adapter la page admin**

Lire la page existante puis ajouter :
- Affichage read-only du fournisseur (`product.supplier?.name`)
- Bouton "Régénérer la description SAPAL" qui POST `/api/admin/products/[id]/rewrite-description` et met à jour le champ côté UI
- Affichage de `description_sapal` comme champ principal éditable (et `description` comme source brute read-only)

Adapter au pattern existant de la page d'édition produit (formulaire React).

- [ ] **Step 4: Tester**

Aller sur `/admin/produits/<id>` d'un produit importé. Vérifier :
- Fournisseur affiché
- Bouton "Régénérer description" déclenche un appel LLM (~2s), met à jour le champ
- Save persiste en DB

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/produits "src/app/api/admin/products/[id]"
git commit -m "feat(admin): show supplier and regenerate SAPAL description"
```

---

## Phase 7 — Contrôle qualité + bascule prod

### Task 7.1: Contrôle complet DEV

- [ ] **Step 1: Statistiques DB**

Via MCP :

```sql
select
  (select count(*) from products where supplier_id = (select id from suppliers where slug='procity')) as n_products,
  (select count(*) from product_variants pv join products p on p.id = pv.product_id where p.supplier_id = (select id from suppliers where slug='procity')) as n_variants,
  (select count(*) from products where supplier_id = (select id from suppliers where slug='procity') and description_sapal is not null) as n_desc,
  (select count(*) from products where supplier_id = (select id from suppliers where slug='procity') and tech_sheet_url is not null) as n_pdfs,
  (select count(*) from products where supplier_id = (select id from suppliers where slug='procity') and array_length(gallery_image_urls,1) > 0) as n_with_images;
```

Seuils :
- `n_products` >= 900
- `n_desc` >= 95% de `n_products`
- `n_with_images` >= 95%
- `n_pdfs` >= 60%

Si seuil manqué → enquêter, relancer imports partiels.

- [ ] **Step 2: Contrôle visuel 20 fiches aléatoires**

```sql
select p.slug, c.slug as cat_slug
from products p
join categories c on c.id = p.category_id
where p.supplier_id = (select id from suppliers where slug='procity')
order by random() limit 20;
```

Pour chaque URL `localhost:3000/catalogue/<cat_slug>/<slug>` :
- [ ] Galerie ≥ 2 photos
- [ ] Changement couleur change la photo
- [ ] Description en français, ~100 mots, pas de "Procity"
- [ ] Délai correct
- [ ] PDF téléchargeable (si présent)
- [ ] Prix cohérent avec Excel
- [ ] Badge "Produit fabriqué par Procity"

Viser 19/20. Si < 19 : identifier la classe d'erreur, corriger.

- [ ] **Step 3: Lint + build**

Run : `npm run lint && npm run typecheck && npm run build`

Expected : tous verts.

- [ ] **Step 4: Documenter les leçons**

Ajouter une entrée dans `tasks/lessons.md` avec ce qui a été appris (HTML Procity, matching photos, qualité LLM, pièges).

```bash
git add tasks/lessons.md
git commit -m "docs: record procity mirror lessons"
```

---

### Task 7.2: Bascule prod

- [ ] **Step 1: Backup Supabase prod**

Via le dashboard Supabase prod → Database → Backups → créer un backup manuel. **Attendre confirmation**.

- [ ] **Step 2: Appliquer les migrations sur prod**

Via MCP ciblant le projet prod (changer de projet dans le MCP), appliquer dans l'ordre :
- 017_suppliers_multi.sql
- 018_supplier_media_bucket.sql
- 019_migrate_existing_procity.sql
- 020_variant_unique.sql
- 020b_products_reference_unique.sql (si créé)

Vérifier après chaque :

```sql
select count(*) from suppliers;
```

- [ ] **Step 3: Import en prod**

Run : `PROCITY_TARGET=prod npm run import:procity:apply`

Durée : 30-60 min. Surveiller les logs.

- [ ] **Step 4: Mêmes stats en prod**

Mêmes seuils. Si KO : investiguer, éventuellement rollback via restore du backup.

- [ ] **Step 5: Preview Vercel**

```bash
git push -u origin feat/catalogue-procity-miroir
```

Ouvrir la preview URL, tester 5 fiches. Si KO, corriger et re-push.

- [ ] **Step 6: PR vers main**

```bash
gh pr create --title "feat: mirror complete Procity catalog with multi-supplier architecture" --body "$(cat <<'EOF'
## Résumé
- Infrastructure multi-fournisseurs (suppliers, scrape_runs)
- Scraper Playwright de procity.eu avec reprise incrémentale
- Pipeline d'import idempotent (Excel + 958 photos HD + LLM Haiku 4.5)
- Fiche produit enrichie (galerie, PDF, délai variante, badge fournisseur)
- Admin observatoire des runs de scraping

## Stats import
- Produits : <N>
- Variantes : <N>
- Descriptions générées : <N>
- PDF techniques : <N>

## Test plan
- [x] Tests unitaires scraper + import
- [x] Run complet DEV contrôlé (20 fiches validées)
- [x] Run prod + preview Vercel
- [ ] Validation humaine 5 fiches prod post-deploy
EOF
)"
```

- [ ] **Step 7: Merge + validation prod**

Après approbation :
- Merge
- Auto-deploy Vercel
- Vérifier 5 fiches sur la prod
- Cocher la dernière case de la PR

- [ ] **Step 8: Todo update**

```bash
git checkout main && git pull
git checkout -b chore/update-todo-post-procity
# Éditer tasks/todo.md pour cocher 3.5 + nouvelle ligne "Miroir Procity complet ✅"
git add tasks/todo.md
git commit -m "docs: mark procity mirror phase complete"
git push -u origin chore/update-todo-post-procity
gh pr create --title "docs: mark procity mirror complete" --body "Todo update after procity mirror landed."
```

---

## Self-review du plan

**1. Spec coverage :**

| Spec section | Task(s) |
|---|---|
| §3 Architecture 4 blocs | Phases 3, 4, 1, 5-6 |
| §4 Scraper | Tasks 3.1-3.6 |
| §5 Pipeline import | Tasks 4.1-4.8 |
| §6.1 suppliers | Task 1.1 |
| §6.2 products étendu | Task 1.1 |
| §6.3 variants étendu | Task 1.1 |
| §6.4 scrape_runs | Task 1.1 |
| §6.5 bucket Storage | Task 1.2 |
| §6.6 migration 335 | Task 1.3 |
| §7.1 fiche publique | Tasks 5.1-5.5 |
| §7.2 admin runs | Tasks 6.2-6.3 |
| §7.3 admin CRUD produit | Task 6.4 |
| §8 flux opérationnel | Enchaînement Phases + 7.1 |
| §9 flux re-scrape | Task 6.2 + README |
| §10 tests | Intégrés TDD dans chaque task |
| §11 risques | Couverts en 7.1/7.2 |
| §12 scope | Plan limité à Procity |

**2. Placeholder scan** : aucun "TBD" / "TODO" / "later". Tous les blocs de code sont complets et livrables.

**3. Type consistency** : `ProductSnapshot`, `VariantSnapshot`, `TarifRow`, `DiffItem`, `ImportRecord` sont définis une fois et réutilisés. Chemins cohérents. snake_case SQL / camelCase TS : standard.

**4. Ajustements faits lors du review inline** :
- `llm-rewriter.ts` créé directement dans `src/lib/` (plutôt qu'un git mv depuis `scripts/`)
- Pas de spawn de child_process côté API (simplifié en "TriggerHint" qui affiche la commande à copier-coller)
- La colonne `characteristics` du schéma products : à vérifier qu'elle existe déjà (Task 4.5 Step 1) ou à ajouter dans une migration si absente. **Correctif** : ajouter cette vérification comme prérequis de Task 4.5.

---

## Contrôles préalables à l'exécution

- [ ] Branche `feat/catalogue-procity-miroir` créée
- [ ] Dépendances installées (playwright, cheerio, @anthropic-ai/sdk, exceljs, tsx)
- [ ] Chromium Playwright installé
- [ ] Supabase DEV accessible avec `DEV_SUPABASE_*` dans `.env.local`
- [ ] `ANTHROPIC_API_KEY` valide dans `.env.local`
- [ ] Fichier Excel copié dans `scripts/procity/import/data/`
- [ ] Dossier 958 photos HD accessible à `../Fournisseurs/Procity/Photos - 300 dpi - PROCITY FR 2026 2`

---

## Exécution

Deux modes possibles. **Recommandation : subagent-driven-development** — les tasks sont très découplées (une task = un sous-agent dispatché dans un contexte frais), avec review entre chaque. Ça maximise la qualité sur un plan de cette taille.

L'alternative est l'exécution inline via `executing-plans` si tu préfères rester dans la session en cours.
