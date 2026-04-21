# Pipeline catalogue Procity

Outils locaux pour scraper procity.eu et mettre à jour la base SAPAL.

## Architecture

```
procity.eu (scraper Playwright)
      │
      ▼
scraper-output/              ← snapshots JSON + images + PDF en local
      │
      ▼
pipeline d'import            ← merge snapshots + Excel + photos HD locales + LLM
      │
      ▼
Supabase (PROD)              ← upsert idempotent products/variants + Storage
```

## Cible Supabase

**Tous les scripts pointent sur la PROD SAPAL** (projet `dpycswobcixsowvxnvdc`).

Raison : les branches Supabase ne supportent pas le schéma historique du projet (migrations incohérentes). La sécurité vient donc du contrôle d'exécution :

1. **Dry-run obligatoire** avant tout apply massif
2. **Limite `--limit N`** sur le premier apply pour valider sur 10 produits
3. **Backup Supabase manuel** via dashboard avant l'apply complet
4. **Idempotence** : upserts par clé naturelle, rejouer est sans risque

## Variables d'environnement

Dans `.env.local` à la racine du site :

```
ANTHROPIC_API_KEY=sk-ant-api03-...          # pour le LLM de réécriture
NEXT_PUBLIC_SUPABASE_URL=https://dpycswobcixsowvxnvdc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role depuis dashboard Supabase>
```

## Workflow standard

```bash
# 1. Scraper procity.eu (2-4h pour ~1000 fiches, throttled)
npm run scrape:procity

# 2. Dry-run (log du diff sans écriture DB)
npm run import:procity:dry

# 3. Apply limité à 10 produits pour contrôle visuel
npm run import:procity:apply -- --limit 10

# 4. Validation : ouvrir 3 fiches dans le navigateur localhost:3000/catalogue/...

# 5. Apply complet
npm run import:procity:apply
```

## Re-scrape périodique

Le fichier `scraper-output/state.json` contient les hashes de chaque fiche.
Relancer `npm run scrape:procity` ne re-télécharge que les fiches modifiées.

## Structure

```
scripts/procity/
├── README.md                # ce fichier
├── shared/
│   └── supabase-client.ts   # client service_role partagé
├── scraper/
│   ├── index.ts             # orchestrateur
│   ├── crawler.ts           # découverte URLs via sitemap
│   ├── fetcher.ts           # Playwright headless
│   ├── extractor.ts         # parse DOM → snapshot JSON
│   ├── media-downloader.ts  # télécharge photos/PDF
│   ├── state.ts             # hashes pour reprise incrémentale
│   └── types.ts             # ProductSnapshot, VariantSnapshot
├── import/
│   ├── index.ts             # orchestrateur (dry-run + apply)
│   ├── excel-parser.ts      # lit tarifprocityvialux2026-fr.xlsx
│   ├── image-matcher.ts     # match snapshot ↔ 958 photos HD locales
│   ├── storage-uploader.ts  # upload Supabase Storage
│   ├── db-writer.ts         # upsert products/variants
│   └── diff-computer.ts     # calcul diffs pour admin review
└── scraper-output/          # généré, gitignore
    ├── state.json
    ├── snapshots/<ref>.json
    ├── images/<ref>/*.jpg
    └── tech-sheets/<ref>.pdf
```

## Observatoire admin

Chaque run d'import crée une entrée dans `scrape_runs` (table Postgres). L'admin peut consulter l'historique des runs via `/admin/fournisseurs/procity/runs` une fois les pages admin déployées.

## Rollback

L'import ne supprime jamais de produit existant — il enrichit ou met à jour.
Pour revenir à un état antérieur : restore du backup Supabase via le dashboard.
