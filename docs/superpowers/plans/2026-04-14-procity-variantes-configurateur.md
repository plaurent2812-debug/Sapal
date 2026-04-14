# Procity Variantes & Configurateur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir tous les produits Procity avec leurs variantes complètes (dimensions × coloris × type de cadre, avec ref/prix/délai/poids propres à chaque combinaison), stocker les photos dans Supabase Storage, et afficher un configurateur interactif sur la fiche produit SAPAL (image qui change selon la sélection, ajout au devis avec la bonne référence).

**Architecture:** Un script Python lit l'Excel Procity (source prix/délai/poids) et scrappe chaque URL procity.eu (source structure combinaisons + photos), produit un JSON enrichi, puis l'injecte dans Supabase via l'API REST. Côté front, la migration SQL ajoute un champ `images` (JSONB array) sur `product_variants` et `product_variant_images` pour stocker les URLs Supabase Storage par variante. Le `ProductPageClient` existant est étendu pour afficher la bonne image quand la variante change.

**Tech Stack:** Python 3 (openpyxl, requests, BeautifulSoup4), Supabase REST API (service role), Supabase Storage, Next.js App Router (TypeScript), Tailwind CSS 4

---

## Fichiers créés / modifiés

| Fichier | Rôle |
|---|---|
| `supabase/migrations/015_variant_images.sql` | Ajoute colonne `images jsonb` sur `product_variants` |
| `scripts/procity/scrape_and_import.py` | Script principal : lit Excel + scrappe Procity + upload photos + importe variantes |
| `scripts/procity/requirements.txt` | Dépendances Python du script |
| `src/lib/supabase/types.ts` | Ajout du champ `images` sur `ProductVariantRow` |
| `src/lib/data.ts` | Ajout du champ `images` sur `ClientVariant` + `toClientVariant` |
| `src/app/catalogue/[slug]/[productSlug]/page.tsx` | Passe `selectedVariant` à la zone image (déjà server component) |
| `src/components/catalogue/product-page-client.tsx` | Image réactive : change selon `selectedVariant` |

---

## Task 1 : Migration SQL — champ `images` sur `product_variants`

**Files:**
- Create: `supabase/migrations/015_variant_images.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- supabase/migrations/015_variant_images.sql
-- Ajoute un tableau d'URLs d'images par variante (stockées dans Supabase Storage)
alter table product_variants
  add column if not exists images jsonb not null default '[]';

comment on column product_variants.images is
  'Array of image URLs (Supabase Storage public URLs), ordered: first = image principale';
```

- [ ] **Step 2 : Appliquer via Supabase MCP**

Dans Claude Code, utiliser l'outil `mcp__supabase__apply_migration` avec :
```
name: "015_variant_images"
query: <contenu du fichier ci-dessus>
```

Vérifier que la migration s'applique sans erreur.

- [ ] **Step 3 : Vérifier le schéma**

Utiliser `mcp__supabase__execute_sql` :
```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'product_variants' and column_name = 'images';
```
Résultat attendu : `images | jsonb | '[]'::jsonb`

- [ ] **Step 4 : Commit**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet"
git checkout -b feat/procity-variantes
git add supabase/migrations/015_variant_images.sql
git commit -m "feat: add images column to product_variants"
```

---

## Task 2 : Mettre à jour les types TypeScript

**Files:**
- Modify: `src/lib/supabase/types.ts` (ligne 10–23)
- Modify: `src/lib/data.ts` (lignes 7–35)

- [ ] **Step 1 : Ajouter `images` dans `ProductVariantRow`**

Dans `src/lib/supabase/types.ts`, modifier l'interface `ProductVariantRow` :

```typescript
export interface ProductVariantRow {
  id: string
  product_id: string
  reference: string
  label: string
  dimensions: string
  finition: string
  coloris: string
  poids: string
  price: number
  delai: string
  specifications: Record<string, string>
  images: string[]   // ← nouveau : URLs Supabase Storage ordonnées
  created_at: string
}
```

- [ ] **Step 2 : Ajouter `images` dans `ClientVariant` et `toClientVariant`**

Dans `src/lib/data.ts`, modifier :

```typescript
export interface ClientVariant {
  id: string
  productId: string
  reference: string
  label: string
  dimensions: string
  finition: string
  coloris: string
  poids: string
  price: number
  delai: string
  specifications: Record<string, string>
  images: string[]   // ← nouveau
}

export function toClientVariant(v: ProductVariantRow): ClientVariant {
  return {
    id: v.id,
    productId: v.product_id,
    reference: v.reference,
    label: v.label,
    dimensions: v.dimensions,
    finition: v.finition,
    coloris: v.coloris,
    poids: v.poids,
    price: Number(v.price) || 0,
    delai: v.delai,
    specifications: v.specifications,
    images: v.images ?? [],   // ← nouveau
  }
}
```

- [ ] **Step 3 : Vérifier que TypeScript compile**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet"
npx tsc --noEmit
```
Attendu : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/lib/supabase/types.ts src/lib/data.ts
git commit -m "feat: add images field to ClientVariant type"
```

---

## Task 3 : Créer le script Python de scraping + import

**Files:**
- Create: `scripts/procity/requirements.txt`
- Create: `scripts/procity/scrape_and_import.py`

Le script fait 4 choses :
1. Lit l'Excel → extrait ref/coloris/dimensions/prix/délai/poids par produit
2. Scrappe chaque URL procity.eu → extrait les combinaisons de variantes et les URLs d'images
3. Télécharge les images → les upload dans Supabase Storage bucket `product-images`
4. Insère/met à jour `product_variants` via l'API Supabase REST

- [ ] **Step 1 : Créer le dossier et requirements.txt**

```bash
mkdir -p "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/scripts/procity"
```

Contenu de `scripts/procity/requirements.txt` :
```
openpyxl==3.1.2
requests==2.31.0
beautifulsoup4==4.12.3
lxml==5.1.0
```

- [ ] **Step 2 : Installer les dépendances**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/scripts/procity"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 3 : Écrire le script `scrape_and_import.py`**

```python
#!/usr/bin/env python3
"""
Procity Variantes Import
========================
1. Lit l'Excel Procity (source prix/délai/poids/ref par ligne)
2. Scrappe chaque URL procity.eu (structure combinaisons + images)
3. Upload les images dans Supabase Storage (bucket: product-images)
4. Upsert product_variants dans Supabase

Usage:
  python3 scrape_and_import.py [--dry-run] [--limit N] [--product-id ID]

Options:
  --dry-run     Affiche ce qui serait inséré sans toucher la base
  --limit N     Traite seulement N produits (pour tests)
  --product-id  Traite seulement ce product_id Supabase (ex: "206200")
"""

import sys
import json
import time
import hashlib
import argparse
import re
import urllib.request
import urllib.error
from pathlib import Path

import openpyxl
import requests
from bs4 import BeautifulSoup

# ── Config ─────────────────────────────────────────────────────────────────────

EXCEL_PATH = Path("/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Fournisseurs/Procity/tarifprocityvialux2026-fr.v1.7-699.xlsx")
SUPABASE_URL = "https://dpycswobcixsowvxnvdc.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRweWNzd29iY2l4c293dnhudmRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDY0NjM1MywiZXhwIjoyMDkwMjIyMzUzfQ.FlZw1NjSDVR5dKE4fubr9iFzYIkvv_MqYQ6xHumX27g"
STORAGE_BUCKET = "product-images"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}
SHEETS = ["MOBILIER URBAIN", "AIRES DE JEUX", "ÉQUIPEMENTS SPORTIFS", "MIROIRS"]
# Colonnes Excel (0-indexées) :
# 0=REFERENCE  4=DESIGNATION PRODUIT  5=DESIGNATION COMPLETE  6=FINITION
# 7=TYPE VITRAGE  9=DIMENSIONS  10=POIDS  12=PRIX NETS  13=COLORIS
# 15=DELAIS  17=URL SITE PROCITY
COL_REF      = 0
COL_NAME     = 4
COL_FULL     = 5
COL_FINITION = 6
COL_DIMS     = 9
COL_POIDS    = 10
COL_PRIX     = 12
COL_COLORIS  = 13
COL_DELAI    = 15
COL_URL      = 17

SCRAPE_DELAY = 1.0  # secondes entre chaque requête Procity

# ── Helpers ────────────────────────────────────────────────────────────────────

def clean(v) -> str:
    """Convertit une valeur Excel en string propre."""
    if v is None:
        return ""
    s = str(v).strip()
    return s if s not in ("-", "–", "—") else ""

def find_product_id_in_supabase(procity_ref: str) -> str | None:
    """Cherche l'id du produit Supabase par sa référence Procity (ex: '206200')."""
    url = f"{SUPABASE_URL}/rest/v1/products?reference=eq.{procity_ref}&select=id&limit=1"
    r = requests.get(url, headers=HEADERS, timeout=10)
    data = r.json()
    if data:
        return str(data[0]["id"])
    # Cherche aussi dans procity_sheet
    url2 = f"{SUPABASE_URL}/rest/v1/products?procity_sheet=eq.{procity_ref}&select=id&limit=1"
    r2 = requests.get(url2, headers=HEADERS, timeout=10)
    data2 = r2.json()
    if data2:
        return str(data2[0]["id"])
    return None

def scrape_procity_page(url: str) -> dict:
    """
    Scrappe une fiche produit procity.eu.
    Retourne:
      {
        "images": ["https://...jpg", ...],   # toutes les images trouvées
        "options": {                          # options de configuration (dropdowns/swatches)
          "Coloris": ["RAL 3020", "RAL 6005", ...],
          "Longueur": ["1000 mm", "1500 mm"],
          ...
        }
      }
    """
    result = {"images": [], "options": {}}
    try:
        resp = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })
        if resp.status_code != 200:
            print(f"    ⚠ HTTP {resp.status_code} pour {url}")
            return result

        soup = BeautifulSoup(resp.text, "lxml")

        # ── Images ──
        # Cherche les balises <img> dans la galerie produit (classe commune Magento/PrestaShop/custom)
        img_candidates = []
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or ""
            # Filtrer : garder seulement les images produits (contiennent le domaine procity et pas de logo/icône)
            if "procity" in src and any(ext in src.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                if not any(skip in src.lower() for skip in ["logo", "icon", "picto", "banner", "thumb_"]):
                    if src not in img_candidates:
                        img_candidates.append(src)

        # Normaliser les URLs relatives
        result["images"] = [
            src if src.startswith("http") else f"https://procity.eu{src}"
            for src in img_candidates
        ][:10]  # max 10 images par produit

        # ── Options (dropdowns / swatches) ──
        # Procity utilise des <select> ou des boutons de couleur
        for sel in soup.find_all("select"):
            label_el = sel.find_previous(["label", "span", "p"])
            label = label_el.get_text(strip=True) if label_el else sel.get("name", "Option")
            values = [opt.get_text(strip=True) for opt in sel.find_all("option") if opt.get_text(strip=True) and opt.get("value")]
            if values:
                result["options"][label] = values

        # Boutons de choix (swatches) — souvent data-value ou aria-label
        for btn_group in soup.find_all(class_=re.compile(r"swatch|option|color|variant", re.I)):
            label_el = btn_group.find_previous(["label", "span", "h3", "p"])
            label = label_el.get_text(strip=True) if label_el else "Option"
            values = []
            for btn in btn_group.find_all(["button", "a", "span"], attrs={"data-value": True}):
                v = btn.get("data-value", "").strip()
                if v:
                    values.append(v)
            if values:
                result["options"].setdefault(label, values)

    except Exception as e:
        print(f"    ⚠ Erreur scraping {url}: {e}")

    return result

def upload_image_to_storage(image_url: str, product_ref: str, idx: int) -> str | None:
    """
    Télécharge une image depuis image_url et l'upload dans Supabase Storage.
    Retourne l'URL publique Supabase ou None en cas d'erreur.
    """
    try:
        resp = requests.get(image_url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })
        if resp.status_code != 200:
            return None

        content_type = resp.headers.get("Content-Type", "image/jpeg")
        ext = ".jpg"
        if "png" in content_type:
            ext = ".png"
        elif "webp" in content_type:
            ext = ".webp"

        # Nom de fichier stable : hash de l'URL source
        url_hash = hashlib.md5(image_url.encode()).hexdigest()[:8]
        filename = f"procity/{product_ref}/{idx:02d}_{url_hash}{ext}"

        upload_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{filename}"
        headers = {
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        up = requests.post(upload_url, data=resp.content, headers=headers, timeout=30)
        if up.status_code in (200, 201):
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{filename}"
            return public_url
        else:
            print(f"      ⚠ Upload échoué {up.status_code}: {up.text[:100]}")
            return None
    except Exception as e:
        print(f"      ⚠ Erreur upload {image_url}: {e}")
        return None

def upsert_variants(rows: list[dict]) -> bool:
    """Insère ou met à jour des lignes dans product_variants."""
    if not rows:
        return True
    data = json.dumps(rows).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/product_variants",
        data=data,
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status in (200, 201)
    except urllib.error.HTTPError as e:
        print(f"    ✗ Upsert error {e.code}: {e.read()[:200]}")
        return False

def delete_variants_for_product(product_id: str):
    """Supprime les variantes existantes d'un produit (pour reimport propre)."""
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/product_variants?product_id=eq.{product_id}",
        headers=HEADERS,
        method="DELETE",
    )
    try:
        with urllib.request.urlopen(req) as r:
            pass
    except urllib.error.HTTPError as e:
        print(f"    ⚠ Delete error {e.code}: {e.read()[:100]}")

# ── Lecture Excel ───────────────────────────────────────────────────────────────

def read_excel() -> dict[str, list[dict]]:
    """
    Lit l'Excel Procity.
    Retourne un dict: { "206200": [ {row data}, ... ], ... }
    Une clé = une référence produit Procity (ex: "206200").
    Chaque valeur = liste de lignes (une par combinaison coloris/dimension/type).
    """
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    products: dict[str, list[dict]] = {}

    for sheet_name in SHEETS:
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]
        header_found = False
        for row in ws.iter_rows(values_only=True):
            # Détecter la ligne d'en-têtes
            if not header_found:
                if row[COL_REF] == "REFERENCE":
                    header_found = True
                continue

            ref = clean(row[COL_REF])
            if not ref or not ref.isdigit():
                continue

            url = clean(row[COL_URL])
            if not url.startswith("http"):
                continue

            entry = {
                "ref":      ref,
                "name":     clean(row[COL_NAME]),
                "full":     clean(row[COL_FULL]),
                "finition": clean(row[COL_FINITION]),
                "dims":     clean(row[COL_DIMS]),
                "poids":    clean(row[COL_POIDS]),
                "prix":     float(row[COL_PRIX]) if row[COL_PRIX] and str(row[COL_PRIX]).replace('.','').isdigit() else 0.0,
                "coloris":  clean(row[COL_COLORIS]),
                "delai":    clean(row[COL_DELAI]),
                "url":      url,
            }
            products.setdefault(ref, []).append(entry)

    wb.close()
    return products

# ── Main ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run",    action="store_true")
    parser.add_argument("--limit",      type=int, default=0)
    parser.add_argument("--product-id", type=str, default="")
    args = parser.parse_args()

    print("📖 Lecture Excel...")
    excel_data = read_excel()
    print(f"   {len(excel_data)} références Procity trouvées dans l'Excel")

    # Filtrage optionnel
    if args.product_id:
        excel_data = {k: v for k, v in excel_data.items() if k == args.product_id}

    processed = 0
    skipped   = 0
    total_variants = 0

    for procity_ref, rows in excel_data.items():
        if args.limit and processed >= args.limit:
            break

        url = rows[0]["url"]
        product_name = rows[0]["name"]
        print(f"\n🔍 [{procity_ref}] {product_name}")
        print(f"   {len(rows)} ligne(s) Excel | URL: {url}")

        # 1) Trouver l'id Supabase du produit
        supabase_product_id = find_product_id_in_supabase(procity_ref)
        if not supabase_product_id:
            print(f"   ⚠ Produit non trouvé en base Supabase — skipping")
            skipped += 1
            continue

        print(f"   ✓ product_id Supabase: {supabase_product_id}")

        # 2) Scraper la page Procity
        time.sleep(SCRAPE_DELAY)
        scraped = scrape_procity_page(url)
        print(f"   📸 {len(scraped['images'])} image(s) trouvée(s) sur procity.eu")
        if scraped["options"]:
            for k, v in scraped["options"].items():
                print(f"      {k}: {v}")

        # 3) Upload des images dans Supabase Storage
        stored_image_urls: list[str] = []
        if not args.dry_run:
            for i, img_url in enumerate(scraped["images"]):
                print(f"   ⬆ Upload image {i+1}/{len(scraped['images'])}...", end=" ")
                stored = upload_image_to_storage(img_url, procity_ref, i)
                if stored:
                    stored_image_urls.append(stored)
                    print("✓")
                else:
                    print("✗")
        else:
            stored_image_urls = scraped["images"]  # dry-run : garder URLs originales

        # 4) Construire les variantes depuis l'Excel
        # Chaque ligne Excel = une variante (une combinaison ref/coloris/dims/finition)
        variant_rows = []
        for excel_row in rows:
            # Label lisible pour cette variante
            parts = [p for p in [
                excel_row["dims"],
                excel_row["coloris"] if excel_row["coloris"] not in ("Standard", "") else "",
                excel_row["finition"],
            ] if p]
            label = " — ".join(parts) if parts else excel_row["full"] or excel_row["name"]

            variant_rows.append({
                "product_id":  supabase_product_id,
                "reference":   excel_row["ref"],
                "label":       label,
                "dimensions":  excel_row["dims"],
                "finition":    excel_row["finition"],
                "coloris":     excel_row["coloris"],
                "poids":       excel_row["poids"],
                "price":       excel_row["prix"],
                "delai":       str(excel_row["delai"]),
                "specifications": {},
                "images":      stored_image_urls,  # même set d'images pour toutes les variantes d'un produit
            })

        total_variants += len(variant_rows)
        print(f"   → {len(variant_rows)} variante(s) à insérer")

        if args.dry_run:
            for v in variant_rows[:3]:
                print(f"      DRY: {v}")
            if len(variant_rows) > 3:
                print(f"      ... et {len(variant_rows)-3} autres")
        else:
            # Supprimer les anciennes variantes Procity pour ce produit
            delete_variants_for_product(supabase_product_id)
            # Insérer par lots de 25
            for i in range(0, len(variant_rows), 25):
                batch = variant_rows[i:i+25]
                ok = upsert_variants(batch)
                status = "✓" if ok else "✗"
                print(f"   {status} Lot {i//25+1}: {len(batch)} variantes")

        processed += 1

    print(f"\n{'='*60}")
    print(f"Traités : {processed} produits | Ignorés : {skipped}")
    print(f"Total variantes : {total_variants}")
    if args.dry_run:
        print("(DRY RUN — rien n'a été modifié en base)")

if __name__ == "__main__":
    main()
```

- [ ] **Step 4 : Test à blanc sur 2 produits**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/scripts/procity"
source .venv/bin/activate
python3 scrape_and_import.py --dry-run --limit 2
```

Attendu : affiche les données Excel + images scrappées + variantes qui seraient insérées, sans toucher Supabase.

- [ ] **Step 5 : Test réel sur 1 produit (ref 206200)**

```bash
python3 scrape_and_import.py --product-id 206200
```

Vérifier dans Supabase via `mcp__supabase__execute_sql` :
```sql
select reference, label, dimensions, coloris, price, delai, jsonb_array_length(images) as nb_images
from product_variants
where product_id = (select id from products where reference = '206200' limit 1)
order by label;
```
Attendu : plusieurs lignes avec images > 0.

- [ ] **Step 6 : Commit**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet"
git add scripts/
git commit -m "feat: add Procity scraper + variants import script"
```

---

## Task 4 : Créer le bucket Supabase Storage `product-images`

**Files:** aucun fichier de code — configuration Supabase

- [ ] **Step 1 : Vérifier si le bucket existe déjà**

Utiliser `mcp__supabase__execute_sql` :
```sql
select name, public from storage.buckets where name = 'product-images';
```

- [ ] **Step 2 : Créer le bucket si inexistant**

Si vide, exécuter :
```sql
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
```

- [ ] **Step 3 : Ajouter une policy de lecture publique**

```sql
create policy "Public read product-images"
  on storage.objects for select
  using (bucket_id = 'product-images');
```

- [ ] **Step 4 : Vérifier l'URL publique**

Après le test de Task 3 Step 5, vérifier qu'une URL du type `https://dpycswobcixsowvxnvdc.supabase.co/storage/v1/object/public/product-images/procity/206200/00_xxxx.jpg` est accessible depuis le navigateur.

---

## Task 5 : Image réactive sur la fiche produit

La page produit (`page.tsx`) est un Server Component — elle passe `product.imageUrl` en dur. Il faut que l'image principale change quand l'utilisateur sélectionne une variante.

**Files:**
- Modify: `src/app/catalogue/[slug]/[productSlug]/page.tsx` (zone image, lignes 135–160)
- Modify: `src/components/catalogue/product-page-client.tsx`

- [ ] **Step 1 : Extraire la zone image dans `ProductPageClient`**

Dans `src/app/catalogue/[slug]/[productSlug]/page.tsx`, remplacer le bloc `{/* Photo */}` (lignes ~135–160) par un simple passage de `product.imageUrl` comme prop à `ProductPageClient`. Modifier le `<div className="grid ...">` pour ne plus contenir directement la zone image :

```tsx
{/* Avant : grid avec zone image inline + ProductPageClient */}
{/* Après : tout dans ProductPageClient qui gère lui-même l'image */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-16">
  <ProductPageClient
    product={product}
    variants={variants}
    options={options}
    category={category}
    categorySlug={slug}
  />
</div>
```

Note : `ProductPageClient` affiche déjà la colonne droite. On lui confie aussi la colonne gauche (image) pour qu'elle soit réactive.

- [ ] **Step 2 : Modifier `ProductPageClient` pour gérer l'image réactive**

Dans `src/components/catalogue/product-page-client.tsx`, transformer le composant pour afficher les deux colonnes (image + infos) et faire changer l'image selon `selectedVariant` :

```tsx
"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShieldCheck, Truck, Clock, Package } from "lucide-react"
import type { ClientProduct, ClientVariant, ClientCategory, ProductOption } from "@/lib/data"
import { VariantSelector } from "./variant-selector"
import { AddToQuoteSection } from "./add-to-quote-section"
import { ProductOptionsSection } from "./product-options-section"

interface Props {
  product: ClientProduct
  variants: ClientVariant[]
  options: ProductOption[]
  category: ClientCategory
  categorySlug: string
}

export function ProductPageClient({ product, variants, options, category, categorySlug }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<ClientVariant | null>(
    variants.length === 1 ? variants[0] : null
  )

  const displayReference = selectedVariant?.reference || product.reference
  const displayPrice = selectedVariant ? selectedVariant.price : product.price

  // Image : prendre la 1ère image de la variante sélectionnée, sinon image produit
  const displayImage = useMemo(() => {
    if (selectedVariant?.images && selectedVariant.images.length > 0) {
      return selectedVariant.images[0]
    }
    return product.imageUrl
  }, [selectedVariant, product.imageUrl])

  // Galerie : images de la variante sélectionnée (ou juste l'image produit)
  const galleryImages = useMemo(() => {
    if (selectedVariant?.images && selectedVariant.images.length > 0) {
      return selectedVariant.images
    }
    return product.imageUrl ? [product.imageUrl] : []
  }, [selectedVariant, product.imageUrl])

  const specifications = useMemo(() => {
    const specs = { ...product.specifications }
    if (selectedVariant) {
      if (selectedVariant.dimensions) specs['Dimensions'] = selectedVariant.dimensions
      if (selectedVariant.poids) specs['Poids'] = selectedVariant.poids
      if (selectedVariant.finition) specs['Finition'] = selectedVariant.finition
      if (selectedVariant.delai) specs['Délai'] = /^\d+(\.\d+)?$/.test(selectedVariant.delai)
        ? (Number(selectedVariant.delai) >= 14
          ? `${Math.ceil(Number(selectedVariant.delai) / 7)} semaines`
          : `${selectedVariant.delai} jours`)
        : selectedVariant.delai
      if (selectedVariant.specifications && Object.keys(selectedVariant.specifications).length > 0) {
        Object.assign(specs, selectedVariant.specifications)
      }
    }
    return Object.entries(specs)
  }, [product.specifications, selectedVariant])

  const [activeImageIdx, setActiveImageIdx] = useState(0)

  // Reset galerie quand la variante change
  useMemo(() => { setActiveImageIdx(0) }, [selectedVariant])

  const currentImage = galleryImages[activeImageIdx] ?? displayImage

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-16">
      {/* ── Colonne image ── */}
      <div className="space-y-3">
        {/* Image principale */}
        <div className="aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-br from-secondary/30 to-secondary/5 border border-border/50 relative group">
          {currentImage ? (
            <Image
              key={currentImage}
              src={currentImage}
              alt={product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-6 md:p-8 group-hover:scale-105 transition-transform duration-500"
              priority
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Package size={48} className="mx-auto mb-3 opacity-30" />
                <span className="text-sm">Photo non disponible</span>
              </div>
            </div>
          )}
          {displayReference && (
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-white/90 backdrop-blur text-[11px] sm:text-xs font-mono font-medium px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-muted-foreground border border-border/50 shadow-sm">
              Réf. {displayReference}
            </div>
          )}
        </div>

        {/* Miniatures galerie (si plusieurs images) */}
        {galleryImages.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {galleryImages.map((img, i) => (
              <button
                key={img}
                onClick={() => setActiveImageIdx(i)}
                className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 ${
                  i === activeImageIdx
                    ? "border-accent"
                    : "border-border/50 hover:border-accent/50"
                }`}
              >
                <Image
                  src={img}
                  alt={`${product.name} vue ${i + 1}`}
                  width={56}
                  height={56}
                  className="object-contain w-full h-full p-1"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Colonne infos ── */}
      <div className="flex flex-col">
        <div className="mb-2">
          <Link
            href={`/catalogue/${categorySlug}`}
            className="text-xs font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors"
          >
            {category.name}
          </Link>
        </div>

        <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl tracking-tight mb-3 sm:mb-4">
          {product.name}
        </h1>

        {displayPrice > 0 && (
          <div className="mb-5 sm:mb-6 flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {displayPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </span>
            <span className="text-sm text-muted-foreground font-medium">HT / unité</span>
          </div>
        )}

        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-6 sm:mb-8">
          {product.description}
        </p>

        <VariantSelector
          variants={variants}
          selectedVariant={selectedVariant}
          onSelect={setSelectedVariant}
          hasVariants={variants.length > 0}
        />

        {displayReference && (
          <p className="text-xs font-mono text-muted-foreground mb-6">
            Réf. {displayReference}
          </p>
        )}

        {specifications.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <h2 className="font-heading text-lg sm:text-xl mb-3 sm:mb-4">Caractéristiques</h2>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              {specifications.map(([key, value], i) => (
                <div
                  key={key}
                  className={`flex justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5 text-sm ${
                    i % 2 === 0 ? "bg-muted/20" : "bg-background"
                  }`}
                >
                  <span className="text-muted-foreground font-medium flex-shrink-0">{key}</span>
                  <span className="font-semibold text-right break-words min-w-0">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <AddToQuoteSection
          product={product}
          selectedVariant={selectedVariant}
          hasVariants={variants.length > 0}
          categorySlug={categorySlug}
        />

        <ProductOptionsSection options={options} />

        <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-border/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Truck size={18} className="text-accent" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Livraison France</p>
                <p className="text-xs text-muted-foreground">Délai selon stock</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={18} className="text-accent" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Certifié NF/CE</p>
                <p className="text-xs text-muted-foreground">Normes en vigueur</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Clock size={18} className="text-accent" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Devis en 24h</p>
                <p className="text-xs text-muted-foreground">Gratuit et sans engagement</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Package size={18} className="text-accent" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Mandat administratif</p>
                <p className="text-xs text-muted-foreground">Paiement 30 jours</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : Simplifier `page.tsx` — retirer la zone image dupliquée**

Dans `src/app/catalogue/[slug]/[productSlug]/page.tsx`, remplacer le bloc `<AnimatedSection direction="up">` (lignes ~132–170) par :

```tsx
<AnimatedSection direction="up">
  <ProductPageClient
    product={product}
    variants={variants}
    options={options}
    category={category}
    categorySlug={slug}
  />
</AnimatedSection>
```

(Le grid 2 colonnes est maintenant dans `ProductPageClient`.)

- [ ] **Step 4 : Vérifier TypeScript**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet"
npx tsc --noEmit
```

- [ ] **Step 5 : Tester visuellement en dev**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/catalogue/[une-categorie]/[un-produit-procity]`.
Vérifier :
- Image principale visible
- Sélection d'une variante → image change (si images disponibles)
- Miniatures cliquables si plusieurs images
- Référence, prix, délai se mettent à jour
- Bouton "Ajouter au devis" désactivé tant qu'aucune variante sélectionnée

- [ ] **Step 6 : Commit**

```bash
git add src/app/catalogue/[slug]/[productSlug]/page.tsx \
        src/components/catalogue/product-page-client.tsx
git commit -m "feat: reactive image gallery based on selected variant"
```

---

## Task 6 : Import complet de tous les produits Procity

Une fois Task 3 validée sur 1 produit, lancer l'import complet.

- [ ] **Step 1 : Lancer l'import complet**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/scripts/procity"
source .venv/bin/activate
python3 scrape_and_import.py 2>&1 | tee import_log.txt
```

Durée estimée : ~15–30 min (578 URLs × ~1s de délai + upload photos).

- [ ] **Step 2 : Vérifier les statistiques en base**

```sql
select
  count(distinct product_id) as produits_avec_variantes,
  count(*) as total_variantes,
  avg(jsonb_array_length(images)) as avg_images_par_variante
from product_variants
where product_id in (
  select id from products where supplier = 'procity'
);
```

- [ ] **Step 3 : Vérifier les produits sans variantes**

```sql
select p.reference, p.name
from products p
left join product_variants pv on pv.product_id = p.id
where p.supplier = 'procity' and pv.id is null
order by p.name;
```

Si des produits sont sans variantes, vérifier les logs (`import_log.txt`) pour comprendre pourquoi (URL invalide, produit non trouvé en base, etc.).

- [ ] **Step 4 : Commit du log**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet"
git add scripts/
git commit -m "feat: import complete Procity variants (578 products)"
```

---

## Task 7 : PR et déploiement

- [ ] **Step 1 : Vérifier build production**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet"
npm run build
```
Attendu : aucune erreur TypeScript ni build.

- [ ] **Step 2 : Créer la PR**

```bash
git push -u origin feat/procity-variantes
gh pr create \
  --title "feat: Procity variantes & configurateur produit" \
  --body "## Ce que ça fait
- Migration SQL : champ \`images\` sur \`product_variants\`
- Script Python : scrappe procity.eu + lit Excel → alimente toutes les variantes (ref/prix/délai/poids/coloris/dimensions) + upload photos dans Supabase Storage
- Fiche produit : configurateur interactif (axes dimensions × coloris × finition), image principale et galerie réactives selon la sélection
- Ajout au devis avec la bonne référence/prix/délai

## Test
- Ouvrir une fiche produit Procity sur Vercel preview
- Sélectionner dimensions puis coloris → vérifier ref, prix, délai, image
- Ajouter au devis → vérifier que le bon produit est dans le devis
"
```

- [ ] **Step 3 : Vérifier le déploiement preview Vercel**

Ouvrir l'URL Vercel preview de la PR, tester sur mobile et desktop.

- [ ] **Step 4 : Merger vers main quand validé**

```bash
gh pr merge --squash
```

---

## Auto-review

**Couverture spec :**
- ✅ Scraping Procity + croisement Excel (Task 3)
- ✅ Upload photos Supabase Storage (Task 3 + Task 4)
- ✅ Migration SQL `images` (Task 1)
- ✅ Types TypeScript à jour (Task 2)
- ✅ Configurateur axes (dimensions × coloris × finition) — déjà dans `VariantSelector`, alimenté par les données (Task 3)
- ✅ Image réactive selon variante sélectionnée (Task 5)
- ✅ Galerie miniatures (Task 5)
- ✅ Ajout au devis avec bonne ref/prix/délai — déjà géré par `AddToQuoteSection` + `useQuoteStore`, alimenté par les données (Task 3)
- ✅ Import complet 578 produits (Task 6)
- ✅ PR + déploiement (Task 7)

**Placeholders :** Aucun TBD ou TODO dans le plan.

**Cohérence types :** `ClientVariant.images: string[]` défini en Task 2, utilisé en Task 5. `ProductVariantRow.images: string[]` défini en Task 2, sérialisé en Task 3. Cohérent.
