# Design — Miroir complet du catalogue Procity sur SAPAL

**Date** : 2026-04-21
**Auteur** : Pierre Laurent + Claude
**État** : Brouillon pour validation

---

## 1. Contexte et objectif

SAPAL est revendeur Procity. Aujourd'hui, ses clients consultent le catalogue Procity pour choisir leurs produits, puis passent commande via SAPAL. L'objectif est que **le site SAPAL reflète à 100% le catalogue Procity** (procity.eu), pour qu'un client n'ait plus à sortir du site SAPAL.

Le site SAPAL contient déjà 335 produits Procity importés depuis l'Excel tarifaire 2026, mais l'import est incomplet :
- Descriptions marketing manquantes ou génériques
- Une seule photo par déclinaison, pas de galerie
- Pas de fiches techniques PDF téléchargeables
- Délais génériques ("selon stock") au lieu des délais Procity réels par produit/déclinaison
- Nombreux produits Procity absents

**Objectif final** : miroir fidèle des 3 univers Procity (Mobilier urbain, Aires de jeux, Équipements sportifs), tous produits, toutes déclinaisons, toutes photos, toutes fiches techniques, avec délais réels et prix SAPAL.

**Contrainte transversale** : l'architecture doit accueillir d'autres fournisseurs à l'avenir sans refactor.

---

## 2. Décisions structurantes (validées)

| # | Décision |
|---|---|
| 1 | Miroir total procity.eu : 3 univers, tous produits, toutes déclinaisons |
| 2 | Source de vérité = scraping du site public procity.eu + Excel pour prix |
| 3 | Descriptions réécrites via LLM au ton SAPAL (zéro duplicate content) |
| 4 | Photos 300 dpi locales (958 fichiers) matchées par référence, fallback site Procity |
| 5 | Galerie multi-photos par produit + photo dédiée par déclinaison |
| 6 | PDF fiches techniques téléchargés et stockés |
| 7 | Délais par produit ET par déclinaison (pas global fournisseur) |
| 8 | Architecture multi-fournisseurs (table `suppliers`) |
| 9 | Re-scrape périodique avec validation admin (diff → approbation) |
| 10 | Stockage médias : Supabase Storage, bucket `supplier-media` |

---

## 3. Architecture globale

Quatre sous-systèmes, faiblement couplés, testables indépendamment :

```
┌─────────────────────────────────────────────────────────────────┐
│                   A. Scraper Procity (Node/TS)                  │
│  - Parcourt sitemap procity.eu                                  │
│  - Extrait HTML structuré par fiche                             │
│  - Télécharge photos et PDF techniques                          │
│  - Produit un snapshot JSON par produit                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓ snapshots JSON
┌─────────────────────────────────────────────────────────────────┐
│              B. Pipeline d'import (Node/TS + LLM)               │
│  - Matche chaque snapshot avec l'Excel (référence)              │
│  - Matche chaque image avec les 958 photos locales HD           │
│  - Réécrit la description via LLM (voix SAPAL)                  │
│  - Produit un batch d'INSERT/UPDATE SQL idempotent              │
└─────────────────────────────────────────────────────────────────┘
                            ↓ SQL + médias
┌─────────────────────────────────────────────────────────────────┐
│       C. Base Supabase (schéma étendu multi-fournisseurs)       │
│  - Table suppliers, products, variants, media, tech_sheets      │
│  - Bucket Storage supplier-media                                │
│  - RLS inchangée (produits publics en lecture)                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓ lecture
┌─────────────────────────────────────────────────────────────────┐
│    D. Front-end + Admin (Next.js, adapté au nouveau schéma)     │
│  - Fiche produit enrichie (galerie, PDF, délai par variante)    │
│  - Écran admin de validation des diffs de re-scrape             │
└─────────────────────────────────────────────────────────────────┘
```

Chaque sous-système a une frontière claire : le scraper ne connaît rien de Supabase, le pipeline d'import ne connaît rien du HTML Procity, la DB ne connaît rien du LLM. On peut rejouer chaque étape isolément.

---

## 4. Sous-système A — Scraper Procity

### 4.1 Responsabilité

**Une seule mission** : transformer procity.eu en un dossier de snapshots JSON + médias bruts. Aucune logique métier SAPAL.

### 4.2 Entrées / sorties

- **Entrée** : URL racine `https://procity.eu/fr/`
- **Sorties** :
  - `scraper-output/snapshots/<reference>.json` (une fiche = un fichier)
  - `scraper-output/images/<reference>/<slug>.jpg`
  - `scraper-output/tech-sheets/<reference>.pdf`
  - `scraper-output/run.log` (traces, erreurs, stats)

### 4.3 Schéma d'un snapshot JSON

```json
{
  "reference": "529777",
  "procity_url": "https://procity.eu/fr/abri-chariots-modulo-1.html",
  "universe": "mobilier-urbain",
  "category_path": ["Mobilier urbain", "Abris"],
  "title": "Abri chariots Modulo",
  "description_raw": "Ce nouvel abri vient compléter notre offre…",
  "availability_default": "5 semaines",
  "weight_kg": 550.0,
  "dimensions": "Lg 2510 mm",
  "type": "Abris",
  "characteristics": [
    { "label": "Type", "value": "Abris" },
    { "label": "Poids", "value": "550.0 kg" },
    { "label": "Dimensions", "value": "Lg 2510 mm" }
  ],
  "variants": [
    {
      "variant_ref": "529777.GPRO",
      "attributes": { "couleur": "Gris Procity", "structure": "Scellement direct" },
      "ral": "GPRO",
      "availability": "5 semaines",
      "images": ["gris-procity-1.jpg", "gris-procity-situ.jpg"]
    },
    { "variant_ref": "529777.9010", "attributes": { "couleur": "RAL 9010" }, "…": "…" }
  ],
  "gallery": ["gris-procity-1.jpg", "gris-procity-situ.jpg", "detail-poteau.jpg"],
  "tech_sheet": "529777.pdf",
  "scraped_at": "2026-04-21T11:38:00Z",
  "content_hash": "sha256:abc123…"
}
```

Le `content_hash` est la clé du re-scrape : s'il ne change pas, on skip.

### 4.4 Techno

- **Playwright (Chromium headless)** plutôt que `fetch` pur : Procity est probablement rendu côté serveur mais utilise du JS pour les sélecteurs de couleur → Playwright capture le DOM après hydratation et peut cliquer sur chaque couleur pour observer le changement d'image (c'est comme ça qu'on mappe image ↔ variante).
- Parsing HTML : **Cheerio** sur le DOM sérialisé.
- Throttling : 1 requête / 2 secondes max, avec backoff exponentiel sur erreur. Un user-agent SAPAL honnête (`SAPAL-Mirror/1.0 (pierre@sapal.fr)`), respect du `robots.txt`.
- Reprise incrémentale : un fichier `scraper-state.json` liste les URLs déjà scrapées avec leur hash.

### 4.5 Cas limites

- **Produit sans déclinaison** : on crée une variante implicite `default`.
- **Produit avec variantes multi-axes** (couleur × structure × taille) : on enregistre tout le produit cartésien déclaré sur la fiche Procity, pas plus.
- **Images partagées entre variantes** : le snapshot les liste dans `gallery` et chaque variante référence celles qui la concernent.
- **Page qui échoue** : on log, on continue, on réessaie en fin de run. Pas de crash global.

---

## 5. Sous-système B — Pipeline d'import

### 5.1 Responsabilité

Transformer les snapshots bruts + les photos locales + l'Excel en opérations DB idempotentes.

### 5.2 Étapes

1. **Lecture Excel** → map `{ reference → { prix_ht, delai_excel, options_tarif } }` (réutiliser le parser Excel existant dans `scripts/procity/`).
2. **Scan photos locales** → map `{ reference → [fichiers locaux HD] }` en se basant sur le pattern de nommage (`012 - Kub - 306425+306390…jpg`).
3. **Pour chaque snapshot** :
   - Vérifier que la référence existe dans l'Excel → sinon : produit ignoré, log warning.
   - Réécrire `description_raw` via LLM (prompt : "Tu es un rédacteur SAPAL. Réécris cette description au ton SAPAL, ni promotionnel ni plat, 80-150 mots. Contexte SAPAL : signalisation Cannes, B2B+B2C, revendeur Procity. Interdit : copier une phrase littérale, utiliser des superlatifs creux."). Sortie = `description_sapal`.
   - Résoudre les images : priorité aux locales HD si match, fallback sur les images scrapées. Upload vers Supabase Storage avec noms déterministes (`products/<supplier>/<ref>/<slot>.jpg`).
   - Upload du PDF tech sheet.
   - Générer les INSERT / UPDATE SQL.
4. **Exécution en dry-run d'abord** (produit SQL mais ne l'applique pas), puis exécution réelle.

### 5.3 Idempotence

Clé unique par produit : `(supplier_id, reference)`.
Clé unique par variante : `(product_id, variant_ref)`.
Tout import rejouable sans doublon. Les photos existantes ne sont ré-uploadées que si leur hash source a changé.

### 5.4 LLM utilisé

Claude Haiku 4.5 via l'API Anthropic (rapide, pas cher, suffisant pour de la réécriture courte). Un appel par produit. Coût estimé : ~1000 produits × 1500 tokens = 1.5M tokens, ordre de grandeur 2-3 € par run complet. Les descriptions sont stockées en DB, donc **un seul appel LLM par produit sur toute la vie du site** sauf re-génération manuelle.

---

## 6. Sous-système C — Schéma Supabase étendu

### 6.1 Nouvelle table `suppliers`

```sql
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,            -- 'procity', 'sti', …
  name text not null,
  website text,
  logo_url text,
  default_availability text,            -- fallback si pas de délai produit
  scraper_config jsonb,                 -- URL racine, sélecteurs, etc.
  created_at timestamptz default now()
);
```

Seed immédiat : un enregistrement `procity`.
Migration existante : tous les produits actuels sont rattachés à `procity` par défaut (les 335 sont tous Procity, les produits STI de la migration 010 seront rattachés à un supplier `sti`).

### 6.2 Table `products` (étendue)

Colonnes ajoutées à la table existante :

```sql
alter table products
  add column supplier_id uuid references suppliers(id),
  add column description_sapal text,           -- description réécrite (public)
  add column description_source_hash text,     -- pour détecter les changements à la source
  add column tech_sheet_url text,              -- PDF dans Storage
  add column gallery_image_urls text[],        -- galerie (hors images variant)
  add column procity_url text,                 -- source canonique pour re-scrape
  add column last_scraped_at timestamptz;
```

La description publique devient `description_sapal`. La description brute Procity **n'est jamais affichée côté public** (elle reste seulement en staging dans le dossier `scraper-output/` pour diffs).

### 6.3 Table `product_variants` (étendue)

```sql
alter table product_variants
  add column availability text,                -- délai spécifique variante
  add column primary_image_url text;           -- photo principale de la variante
```

Le délai cascade : `variant.availability ?? product.availability ?? supplier.default_availability`.

### 6.4 Table `scrape_runs` (nouvelle — pour le workflow de validation)

```sql
create table scrape_runs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id),
  started_at timestamptz not null,
  finished_at timestamptz,
  status text check (status in ('running','completed','failed','pending_review','applied','rejected')),
  stats jsonb,                         -- { new: 12, updated: 34, removed: 2, errors: 0 }
  diff_payload jsonb                   -- détails des changements pour review admin
);
```

### 6.5 Supabase Storage

Bucket unique `supplier-media`, public en lecture, structure :

```
supplier-media/
  procity/
    products/
      <reference>/
        gallery/
          <slot>.jpg
        variants/
          <variant_ref>.jpg
        tech-sheet.pdf
```

### 6.6 Migration des 335 produits existants

Écrite comme migration SQL pure (pas de script) : UPDATE pour rattacher à `procity`, copier `description` (s'il existe) dans `description_sapal`, renommer les images vers la nouvelle arborescence Storage. Un seul passage, idempotent.

---

## 7. Sous-système D — Front-end & Admin

### 7.1 Fiche produit publique (ce qui change)

- Galerie : carrousel avec photo principale variante en premier, puis `gallery_image_urls`. Sur changement de couleur, la première image bascule sur `variant.primary_image_url`.
- Bouton "Télécharger la fiche technique" → lien direct sur `tech_sheet_url`.
- Bloc "Disponibilité" : affiche `variant.availability` avec fallback produit puis fallback fournisseur.
- Bloc description : `description_sapal`, avec fallback sur un template minimal si null (pour éviter les vides le temps que le LLM passe sur tous les produits).
- Footer fiche : badge discret "Produit fabriqué par Procity" (loyauté fournisseur + utile pour le SEO, évite la confusion avec les produits SAPAL maison).

### 7.2 Admin — écran "Runs de scraping"

Nouvelle route `/admin/fournisseurs/procity/runs` :

- Liste des runs passés (date, stats, statut).
- Bouton "Lancer un scrape" (déclenche le scraper en background via une route `/api/admin/scrape/run`).
- Un run en état `pending_review` : l'admin voit un diff structuré (nouveaux produits, modifiés, supprimés), peut cocher/décocher les changements à appliquer, puis bouton "Appliquer la sélection".

### 7.3 Admin — CRUD produit

Adapté pour afficher :
- Le fournisseur (read-only après création).
- Un bouton "Régénérer la description" (relance le LLM sur la description brute stockée en staging).
- Upload manuel d'une photo galerie ou d'un PDF tech sheet (pour patcher à la main si le scraping rate).

---

## 8. Flux opérationnel complet (premier import total)

1. Migration SQL `017_suppliers_multi.sql` : création `suppliers`, `scrape_runs`, colonnes ajoutées aux tables existantes, rattachement des 335 produits à Procity.
2. Migration Storage `018_supplier_media_bucket.sql` : création bucket + policies RLS.
3. Seed `procity` dans `suppliers`.
4. Lancer scraper Procity en local (durée estimée : 2-4h pour 1000+ fiches, throttled).
5. Lancer pipeline d'import en dry-run → inspection du SQL généré.
6. Lancer pipeline d'import en mode réel → DB remplie + médias uploadés.
7. Validation manuelle sur 10 fiches aléatoires en preview.
8. Push sur branche dédiée → preview Vercel → validation → merge.

Durée totale estimée du premier run : 1 journée de dev (hors rédaction du scraper lui-même).

---

## 9. Flux de re-scrape périodique

1. Cron mensuel déclenche `/api/admin/scrape/run` (ou bouton admin).
2. Scraper tourne en background, compare les hashes, produit un `scrape_runs` en `pending_review`.
3. Admin reçoit notification Telegram ("Run Procity terminé : 12 nouveaux, 34 modifiés, 2 supprimés").
4. Admin review dans `/admin/fournisseurs/procity/runs/<id>`.
5. Application sélective → DB mise à jour → descriptions LLM régénérées seulement pour les produits modifiés.

---

## 10. Tests

- **Scraper** : fixtures HTML (snapshots pris sur 5-10 fiches Procity réelles) + tests unitaires des extracteurs. Pas de tests E2E contre le vrai Procity (fragile, hors CI).
- **Pipeline d'import** : tests unitaires par étape (Excel parser, image matcher, LLM adapter mocké). Un test d'intégration complet sur 3 snapshots fixtures → DB de test → assertions sur les rows créées.
- **Front-end** : tests Playwright existants à étendre (fiche produit avec galerie, changement de variante met à jour la photo, téléchargement PDF).
- **Admin diff review** : test d'intégration sur un run synthétique (3 ajouts, 2 modifs, 1 suppression).

---

## 11. Risques et parades

| Risque | Parade |
|--------|--------|
| Procity modifie la structure HTML → scraper casse | Tests sur fixtures + alerte si `stats.errors > 5%` → l'admin est prévenu, l'ancien contenu reste en place |
| Procity bloque le scraping (rate limit, captcha) | Throttling généreux + user-agent identifiable + si bloqué, fallback : demander à SAPAL de contacter Procity pour un accès officiel (API ou flux PIM) |
| Volumétrie Storage trop élevée | On mesure après premier run. Si > 10 Go, on passe en plan Supabase supérieur ou on migre vers Cloudflare R2 (la couche Storage est encapsulée dans `lib/storage.ts`) |
| Descriptions LLM médiocres ou hallucinées | Validation humaine sur échantillon avant premier déploiement + bouton "Régénérer" en admin + prompt contraint explicitement "ne pas inventer de caractéristiques" |
| Coût LLM sur run complet | Haiku 4.5 suffit. Si budget serré, on peut passer sur Haiku 3.5 qui est encore moins cher |
| Conflit avec les 335 produits actuels | Migration rattache proprement, dry-run obligatoire, rollback = `git revert` + restore DB depuis backup Supabase |

---

## 12. Scope explicite (pour ne pas déborder)

**Inclus** :
- Tout ce qui précède pour **Procity uniquement**.
- Architecture multi-fournisseurs prête (`suppliers`, colonnes), mais seed unique Procity.
- Admin review des runs.
- Descriptions LLM.

**Hors scope de ce spec** (à spécifier plus tard, chacun dans son propre design) :
- Scrapers d'autres fournisseurs (STI, etc.) — chaque fournisseur aura son propre scraper adapté à son site.
- Traduction multilingue.
- Catalogue vers Google Shopping / flux PIM sortant.
- Sync automatique des prix depuis nouveaux Excel tarifaires (l'Excel reste manuel pour l'instant).

---

## 13. Livrables

1. Migrations SQL : `017_suppliers_multi.sql`, `018_supplier_media_bucket.sql`.
2. Package scraper : `scripts/procity/scraper/` (TypeScript, Playwright).
3. Package import : `scripts/procity/import/` (TypeScript, Supabase client, LLM adapter).
4. Adaptations front : fiche produit `/catalogue/[slug]/[productSlug]`, admin CRUD, nouvelle route `/admin/fournisseurs/procity/runs`.
5. Route API `/api/admin/scrape/run` (background job).
6. Tests associés.
7. README dans `scripts/procity/` documentant les commandes : `pnpm scrape:procity`, `pnpm import:procity --dry-run`, `pnpm import:procity --apply`.

---

## 14. Critères de succès

- Un visiteur SAPAL voit une fiche produit Procity **indiscernable en richesse** de la fiche Procity originale (photos, délai, PDF, options).
- L'admin peut relancer un scrape et valider les changements en moins de 15 minutes.
- Aucun produit Procity du catalogue actif n'est absent du site SAPAL.
- Ajouter un deuxième fournisseur consiste à : écrire un scraper + un enrichisseur spécifique, **sans toucher au schéma DB ni au front-end**.
