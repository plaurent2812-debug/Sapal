# Addendum 2026-04-21 — Corrections après inspection de la prod réelle

Ce document corrige le plan initial `2026-04-21-catalogue-procity-miroir.md` après inspection directe du schéma Supabase de production. **Lire cet addendum AVANT le plan** — il est prioritaire en cas de contradiction.

## État réel de la prod découvert

**Projet Supabase prod :** `dpycswobcixsowvxnvdc` (SAPAL)

| Aspect | Plan initial supposait | Réalité prod |
|---|---|---|
| Nombre de produits | 335 | **467** (334 Procity + 133 sans supplier) |
| Table `suppliers` | N'existait pas, à créer | **Existe déjà** (orientée contact commercial, avec email/phone/siret) |
| `products.supplier_id` | À créer (FK uuid) | **Existe déjà** (uuid, FK vers suppliers, SET NULL on delete) |
| `products.id` | uuid supposé | **text** (ex: "2023", "1071") |
| `product_variants` | Table à créer/étendre | **Existe, 4 669 rows**, avec colonnes `coloris`, `delai`, `images jsonb`, `reference`, `price` |
| `products.specifications` | N'existait pas | **Existe** (jsonb — contient Type, Poids, Dimensions) |
| `products.procity_family`, `products.procity_type` | N'existait pas | **Existent** |
| `products.supplier` (text) | N'existait pas | **Existe** (valeurs: `procity`, NULL) |
| Migrations locales | 016 dernière | Local est à `016`, **prod a 21 migrations via timestamps** — repo local désynchronisé |

## Suppliers existants en prod

- `Procity` (slug: `procity`, id: `74f6f2d4-4cf7-4b24-9627-2da9967830e0`) — **déjà lié à 334 produits**
- `Signaux Girod (Test)` (slug: `signaux-girod-test`) — fournisseur de test

Les 133 produits sans `supplier_id` sont probablement des produits SAPAL/STI (signalisation) — on ne les touche pas.

## Corrections au plan initial

### Phase 1 — Une seule migration au lieu de 4

**Les migrations 017 / 018 / 019 / 020 du plan initial sont REMPLACÉES par :**

#### Migration unique : `supabase/migrations/20260421_procity_mirror.sql`

```sql
-- Enrichissement du schéma pour le miroir Procity
-- Architecture : la table suppliers existe déjà (orientée contact commercial)
-- on ajoute les colonnes nécessaires au scraping, et on ne recrée RIEN d'existant.

begin;

-- Enrichir suppliers
alter table public.suppliers
  add column if not exists website text,
  add column if not exists logo_url text,
  add column if not exists default_availability text,
  add column if not exists scraper_config jsonb default '{}'::jsonb;

-- MAJ du supplier Procity existant
update public.suppliers
set website = coalesce(website, 'https://procity.eu'),
    default_availability = coalesce(default_availability, 'Délai à confirmer')
where slug = 'procity';

-- Enrichir products
alter table public.products
  add column if not exists description_sapal text,
  add column if not exists description_source_hash text,
  add column if not exists tech_sheet_url text,
  add column if not exists gallery_image_urls text[] default '{}',
  add column if not exists procity_url text,
  add column if not exists last_scraped_at timestamptz;

-- Enrichir product_variants
alter table public.product_variants
  add column if not exists primary_image_url text;

-- Contrainte d'unicité pour upsert idempotent
alter table public.product_variants
  drop constraint if exists product_variants_product_reference_unique;
alter table public.product_variants
  add constraint product_variants_product_reference_unique unique (product_id, reference);

-- Table scrape_runs (observatoire admin)
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

alter table public.scrape_runs enable row level security;
drop policy if exists "scrape_runs_admin_only" on public.scrape_runs;
create policy "scrape_runs_admin_only" on public.scrape_runs
  for all using ((auth.jwt() ->> 'role') = 'admin' or auth.role() = 'service_role');

commit;
```

Cette migration est **idempotente** (tous les `if not exists`), donc applicable sur la branche procity-mirror puis à nouveau sur la prod au merge sans risque.

#### Phase 1 devient :

- **Task 1.1 (unique)** : créer et appliquer la migration ci-dessus sur la branche Supabase `procity-mirror`. Vérifier les colonnes/table créées.
- **Task 1.2** : bucket Storage `supplier-media` (inchangé vs plan initial).
- ~~Task 1.3~~ : supprimée (supplier Procity et rattachement déjà faits en prod).
- ~~Task 1.4~~ : intégrée à Task 1.1.

### Phase 2 — Types adaptés au schéma réel

Les types `ProductSnapshot` / `VariantSnapshot` du plan initial **restent bons** côté scraper (ils représentent ce que le site Procity expose, indépendant de notre DB). Le **mapping vers la DB** change — documenté dans Task 4.5.

### Phase 4 — Task 4.5 (DB writer) — schéma cible différent

Au lieu du schéma "plan initial", le writer doit respecter le schéma réel :

**products** (upsert par `reference` — mais attention : pas de contrainte UNIQUE sur `reference`, donc on fera un SELECT puis INSERT/UPDATE) :
- `id` : text. Pour un nouveau produit, on utilise la `reference` Procity comme `id` (ex: `id = "529777"`)
- `supplier_id` : uuid du supplier Procity
- `supplier` : "procity" (string column legacy, on continue à la remplir)
- `reference`, `name`, `slug` : comme avant
- `description` : description brute Procity (source)
- `description_sapal` : description réécrite par LLM
- `description_source_hash` : hash snapshot
- `specifications jsonb` : reprend `characteristics` du snapshot (Type, Poids, Dimensions, …)
- `procity_url`, `procity_family`, `procity_type` : extrait du snapshot (universe / categoryPath)
- `image_url` : URL locale ou Storage de l'image principale produit
- `gallery_image_urls text[]` : galerie complète (nouvelle colonne)
- `tech_sheet_url` : PDF Storage
- `last_scraped_at` : timestamp du scrape

**product_variants** (upsert par `(product_id, reference)` — contrainte ajoutée par la migration) :
- `product_id` : text, FK vers products
- `reference` : variant ref (ex: `529777.GPRO`)
- `coloris` : nom couleur (ex: `Gris Procity`)
- `dimensions`, `finition`, `poids` : si présents dans l'extrait
- `delai` : délai spécifique variante (string, ex: `5 semaines`)
- `price` : prix HT depuis Excel
- `images jsonb` : array d'URLs Storage pour cette variante
- `primary_image_url` : URL principale (nouvelle colonne)
- `specifications jsonb` : métadonnées complémentaires

**Changement de nommage important :** ce qui dans le plan s'appelait `variant_ref` → devient `reference` (colonne DB). `availability` → `delai`. Les sous-agents DB writer devront respecter ces noms réels.

### Phase 4 — Task 4.8 (Apply limité)

Les 334 produits Procity existants ont déjà `supplier_id`, `reference`, `name`, `slug`, `price`, `image_url`, `specifications`. Ce qu'on va changer par l'import :
- Ajouter `description_sapal` (nouveau)
- Ajouter `description_source_hash` (nouveau)
- Ajouter `tech_sheet_url` (nouveau)
- Ajouter `gallery_image_urls` (nouveau)
- Ajouter `procity_url` (nouveau)
- Mettre à jour `last_scraped_at`
- Enrichir `specifications` avec les caractéristiques du scraping

**Ne jamais écraser** : `image_url` (garder l'existant sauf si null), `description` (garder l'existant — c'est la source), `name`, `slug`, `price`, `category_id`.

Les variantes existantes (4 669 rows) seront enrichies de `primary_image_url` et mises à jour si les images changent.

### Phase 7 — Bascule prod via merge de branche Supabase

Au lieu de "backup + apply migrations manuelles sur prod", le workflow devient :

1. Toute la phase dev + test se fait sur la branche Supabase `procity-mirror` (project_ref: `qbqdvskdfqnskonxgove`)
2. Une fois validé (Task 7.1 réussie), on fait **merge branche → main** via le MCP `merge_branch`
3. Les migrations appliquées sur la branche sont rejouées sur la prod atomiquement
4. Backup de sécurité automatique avant merge (fait par Supabase)

**⚠️ Point vigilance :** le merge Supabase ne copie pas automatiquement les données de la branche vers main. Les INSERT/UPDATE de produits/variants doivent être rejoués sur la prod après le merge (en ciblant la prod avec `PROCITY_TARGET=prod`). Le merge applique uniquement le schéma (DDL).

**Workflow détaillé bascule prod :**
1. Merge de la branche → les colonnes + table scrape_runs + bucket apparaissent en prod
2. Puis : `PROCITY_TARGET=prod npm run import:procity:apply` → scan les snapshots, met à jour les 334 produits Procity existants (ajoute descriptions, PDFs, galeries) et ajoute les produits Procity manquants
3. Vérification visuelle sur 5 fiches prod
4. Fin.

## Ajustement Task 0.2 (Supabase switch)

Le switch DEV/PROD utilise maintenant :
- **DEV** = branche Supabase `procity-mirror`, project_ref `qbqdvskdfqnskonxgove`
- **PROD** = projet SAPAL, project_ref `dpycswobcixsowvxnvdc`

Variables d'environnement à ajouter à `.env.local` :

```
# PROD (SAPAL main)
NEXT_PUBLIC_SUPABASE_URL=https://dpycswobcixsowvxnvdc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<récupérer du dashboard projet main>

# DEV (branche procity-mirror)
DEV_SUPABASE_URL=https://qbqdvskdfqnskonxgove.supabase.co
DEV_SUPABASE_SERVICE_ROLE_KEY=<récupérer du dashboard branche>
```

Le fichier `scripts/procity/shared/supabase-client.ts` du plan initial reste valide — il lit ces variables.

## Résumé des écarts avec le plan initial

| Plan initial | Nouveau |
|---|---|
| 4 migrations (017, 018, 019, 020) | 1 migration consolidée `20260421_procity_mirror.sql` + bucket |
| Seed supplier Procity | **Déjà fait en prod**, juste UPDATE pour website/availability |
| Rattacher 335 produits à Procity | **Déjà fait en prod**, 334 rattachés |
| Créer table `product_variants` | **Existe** avec 4 669 rows |
| Types SQL `uuid` pour products.id | **Réalité : text** — le DB writer génère les id à partir de la reference |
| "description", "availability" comme noms de colonnes variant | **Réalité : `delai`, `coloris`, `reference`** |
| Bascule prod via apply migrations manuelles | **Via merge branche Supabase** |

## Ce qui reste inchangé

- Toute la Phase 3 (scraper) : même logique, mêmes fichiers
- Toute la Phase 4 sauf Task 4.5 : même logique
- Toute la Phase 5 (front-end) : les composants restent, seul le fetch SQL change pour les nouveaux noms de colonnes
- Toute la Phase 6 (admin) : inchangée
- Task 7.1 (QA) : inchangée
