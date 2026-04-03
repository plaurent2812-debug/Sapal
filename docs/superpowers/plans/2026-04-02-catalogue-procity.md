# Catalogue ProCity — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un espace "Catalogue ProCity" dans le site SAPAL, accessible depuis le header, reflétant la hiérarchie du tarif ProCity 2026 (4 onglets → catégories → types de produits).

**Architecture:** 4 colonnes supplémentaires dans `products` (supplier, procity_sheet, procity_family, procity_type) + script Python one-shot pour taguer les produits existants par matching de référence + page `/catalogue/procity` avec Server Component + Client Component pour les filtres en cascade.

**Tech Stack:** Next.js 16 App Router, Supabase, TypeScript, Tailwind CSS 4, lucide-react

---

## Fichiers touchés

| Fichier | Action |
|---------|--------|
| `scripts/tag-procity-products.py` | Créer — script one-shot Python qui lit l'Excel et génère du SQL |
| `src/lib/supabase/types.ts` | Modifier — ajouter 4 champs à `ProductRow` |
| `src/lib/data.ts` | Modifier — étendre `ClientProduct`, `toClientProduct`, ajouter `getProcityProducts()` |
| `src/app/catalogue/procity/page.tsx` | Créer — Server Component |
| `src/components/catalogue/procity-catalogue-client.tsx` | Créer — Client Component avec onglets + dropdowns + grille |
| `src/components/layout/header.tsx` | Modifier — ajouter lien nav desktop |
| `src/components/layout/mobile-nav.tsx` | Modifier — ajouter lien dans NAV_LINKS |
| `src/app/sitemap.ts` | Modifier — ajouter `/catalogue/procity` |

---

## Task 1 : Migration Supabase — ajouter les colonnes ProCity

**Files:**
- Aucun fichier projet modifié — SQL à exécuter directement dans Supabase

- [ ] **Step 1 : Exécuter la migration SQL via le MCP Supabase ou le dashboard**

Ouvrir Supabase > SQL Editor (ou utiliser le MCP `execute_sql`) et exécuter :

```sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier        text,
  ADD COLUMN IF NOT EXISTS procity_sheet   text,
  ADD COLUMN IF NOT EXISTS procity_family  text,
  ADD COLUMN IF NOT EXISTS procity_type    text;

CREATE INDEX IF NOT EXISTS idx_products_supplier
  ON products(supplier)
  WHERE supplier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_procity_sheet
  ON products(procity_sheet)
  WHERE procity_sheet IS NOT NULL;
```

- [ ] **Step 2 : Vérifier que les colonnes existent**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('supplier', 'procity_sheet', 'procity_family', 'procity_type');
```

Résultat attendu : 4 lignes avec `data_type = 'text'`.

---

## Task 2 : Script de tagging des produits ProCity

**Files:**
- Créer : `scripts/tag-procity-products.py`

> Ce script lit le fichier Excel ProCity, construit un mapping référence → {sheet, family, type}, puis génère le SQL d'UPDATE. Le SQL généré est ensuite exécuté dans Supabase.

- [ ] **Step 1 : Créer le script**

Créer `scripts/tag-procity-products.py` avec ce contenu :

```python
#!/usr/bin/env python3
"""
Script one-shot : lit le tarif ProCity 2026 et génère le SQL
pour taguer les produits correspondants en base.

Usage :
  /Library/Developer/CommandLineTools/usr/bin/python3 scripts/tag-procity-products.py \
    > /tmp/tag-procity.sql

Puis exécuter le fichier SQL généré dans Supabase SQL Editor.
"""
import sys
import openpyxl

EXCEL_PATH = "Procity/tarifprocityvialux2026-fr.v1.7-699.xlsx"  # relatif à la racine du projet SAPAL

# Configuration de chaque onglet :
# sheet_name → (col_index_famille, col_index_type, col_index_reference)
# Les index sont 0-based
SHEETS = {
    "MOBILIER URBAIN":       (2, 3, 0),
    "AIRES DE JEUX":         (2, 3, 0),
    "ÉQUIPEMENTS SPORTIFS":  (2, 3, 0),
    "MIROIRS":               (3, 4, 0),  # col A = ref SPL, col D = famille, col E = type
}

HEADER_ROWS = 5  # Les 5 premières lignes sont des headers dans chaque onglet

def escape_sql(s: str) -> str:
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def main():
    try:
        wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
    except FileNotFoundError:
        print(f"-- ERREUR : fichier introuvable : {EXCEL_PATH}", file=sys.stderr)
        print(f"-- Lancer ce script depuis la racine du dossier client SAPAL", file=sys.stderr)
        sys.exit(1)

    # mapping : reference -> (sheet, family, type)
    mapping: dict[str, tuple[str, str, str]] = {}

    for sheet_name, (fam_idx, type_idx, ref_idx) in SHEETS.items():
        if sheet_name not in wb.sheetnames:
            print(f"-- ATTENTION : onglet '{sheet_name}' introuvable dans le fichier", file=sys.stderr)
            continue
        ws = wb[sheet_name]
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i < HEADER_ROWS:
                continue
            ref = row[ref_idx] if len(row) > ref_idx else None
            fam = row[fam_idx] if len(row) > fam_idx else None
            typ = row[type_idx] if len(row) > type_idx else None
            if ref and fam:
                ref_str = str(int(ref)) if isinstance(ref, float) else str(ref).strip()
                fam_str = str(fam).strip()
                typ_str = str(typ).strip() if typ else None
                if ref_str not in mapping:
                    mapping[ref_str] = (sheet_name, fam_str, typ_str)

    print("-- SQL généré automatiquement par tag-procity-products.py")
    print(f"-- {len(mapping)} références ProCity trouvées dans l'Excel")
    print()

    count = 0
    for ref, (sheet, family, typ) in sorted(mapping.items()):
        print(
            f"UPDATE products SET "
            f"supplier = 'procity', "
            f"procity_sheet = {escape_sql(sheet)}, "
            f"procity_family = {escape_sql(family)}, "
            f"procity_type = {escape_sql(typ)} "
            f"WHERE reference = {escape_sql(ref)};"
        )
        count += 1

    print()
    print(f"-- Total : {count} UPDATE générés")
    print()
    print("-- Vérification après UPDATE :")
    print("-- SELECT COUNT(*) FROM products WHERE supplier = 'procity';")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2 : Générer le SQL depuis la racine du dossier client SAPAL**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL"
/Library/Developer/CommandLineTools/usr/bin/python3 "Site internet/scripts/tag-procity-products.py" > /tmp/tag-procity.sql
head -30 /tmp/tag-procity.sql
```

Résultat attendu : voir des lignes `UPDATE products SET supplier = 'procity', ...` avec les références ProCity.

- [ ] **Step 3 : Exécuter le SQL dans Supabase**

Ouvrir le fichier `/tmp/tag-procity.sql` et exécuter son contenu dans Supabase SQL Editor (ou via MCP `execute_sql`).

- [ ] **Step 4 : Vérifier le nombre de produits taggués**

```sql
SELECT
  procity_sheet,
  COUNT(*) AS nb_produits
FROM products
WHERE supplier = 'procity'
GROUP BY procity_sheet
ORDER BY procity_sheet;
```

Résultat attendu : lignes pour MOBILIER URBAIN, AIRES DE JEUX, ÉQUIPEMENTS SPORTIFS, MIROIRS avec des comptages > 0.

- [ ] **Step 5 : Commit**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet"
git add scripts/tag-procity-products.py
git commit -m "feat: script de tagging des produits ProCity par référence Excel"
```

---

## Task 3 : Mise à jour des types TypeScript

**Files:**
- Modifier : `src/lib/supabase/types.ts`
- Modifier : `src/lib/data.ts`

- [ ] **Step 1 : Étendre `ProductRow` dans `types.ts`**

Dans `src/lib/supabase/types.ts`, ajouter les 4 champs à l'interface `ProductRow` (après `supplier_url`) :

```typescript
export interface ProductRow {
  id: string
  category_id: string
  name: string
  slug: string
  description: string
  specifications: Record<string, string>
  image_url: string
  price: number
  reference: string
  supplier_url: string
  supplier: string | null
  procity_sheet: string | null
  procity_family: string | null
  procity_type: string | null
  created_at: string
}
```

- [ ] **Step 2 : Étendre `ClientProduct` et `toClientProduct` dans `data.ts`**

Dans `src/lib/data.ts`, modifier l'interface `ClientProduct` (après `reference`) :

```typescript
export interface ClientProduct {
  id: string
  categoryId: string
  categorySlug?: string
  name: string
  slug: string
  description: string
  specifications: Record<string, string>
  imageUrl: string
  price: number
  reference: string
  supplier?: string
  procitySheet?: string
  procityFamily?: string
  procityType?: string
}
```

Modifier `toClientProduct` pour mapper les nouveaux champs :

```typescript
export function toClientProduct(p: Product, categorySlug?: string): ClientProduct {
  return {
    id: p.id,
    categoryId: p.category_id,
    categorySlug,
    name: p.name,
    slug: p.slug,
    description: p.description,
    specifications: p.specifications,
    imageUrl: p.image_url,
    price: Number(p.price) || 0,
    reference: p.reference || '',
    supplier: p.supplier ?? undefined,
    procitySheet: p.procity_sheet ?? undefined,
    procityFamily: p.procity_family ?? undefined,
    procityType: p.procity_type ?? undefined,
  }
}
```

- [ ] **Step 3 : Ajouter `getProcityProducts()` dans `data.ts`**

Ajouter à la fin de `src/lib/data.ts` :

```typescript
export async function getProcityProducts(): Promise<ClientProduct[]> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(slug)')
    .eq('supplier', 'procity')
    .order('name')

  if (error) throw error
  return (data ?? []).map((p: Product & { categories?: { slug: string } }) =>
    toClientProduct(p, p.categories?.slug)
  )
}
```

- [ ] **Step 4 : Vérifier la compilation TypeScript**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet"
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/supabase/types.ts src/lib/data.ts
git commit -m "feat: ajouter champs procity dans ProductRow, ClientProduct et getProcityProducts()"
```

---

## Task 4 : Composant client ProCity

**Files:**
- Créer : `src/components/catalogue/procity-catalogue-client.tsx`

- [ ] **Step 1 : Créer le composant**

Créer `src/components/catalogue/procity-catalogue-client.tsx` :

```tsx
"use client"

import { useState, useMemo } from "react"
import { ProductCard } from "@/components/catalogue/product-card"
import type { ClientProduct } from "@/lib/data"
import { ChevronDown } from "lucide-react"

const SHEETS = [
  "MOBILIER URBAIN",
  "AIRES DE JEUX",
  "ÉQUIPEMENTS SPORTIFS",
  "MIROIRS",
] as const

type Sheet = typeof SHEETS[number]

interface Props {
  products: ClientProduct[]
}

export function ProcityCatalogueClient({ products }: Props) {
  const [activeSheet, setActiveSheet] = useState<Sheet>("MOBILIER URBAIN")
  const [activeFamily, setActiveFamily] = useState<string>("Toutes")
  const [activeType, setActiveType] = useState<string>("Tous")

  // Produits de l'onglet actif
  const sheetProducts = useMemo(
    () => products.filter((p) => p.procitySheet === activeSheet),
    [products, activeSheet]
  )

  // Familles disponibles pour l'onglet actif
  const families = useMemo(() => {
    const set = new Set(sheetProducts.map((p) => p.procityFamily).filter(Boolean) as string[])
    return ["Toutes", ...Array.from(set).sort()]
  }, [sheetProducts])

  // Types disponibles pour la famille active
  const types = useMemo(() => {
    const source = activeFamily === "Toutes" ? sheetProducts : sheetProducts.filter((p) => p.procityFamily === activeFamily)
    const set = new Set(source.map((p) => p.procityType).filter(Boolean) as string[])
    return ["Tous", ...Array.from(set).sort()]
  }, [sheetProducts, activeFamily])

  // Produits filtrés finaux
  const filtered = useMemo(() => {
    return sheetProducts.filter((p) => {
      if (activeFamily !== "Toutes" && p.procityFamily !== activeFamily) return false
      if (activeType !== "Tous" && p.procityType !== activeType) return false
      return true
    })
  }, [sheetProducts, activeFamily, activeType])

  function handleSheetChange(sheet: Sheet) {
    setActiveSheet(sheet)
    setActiveFamily("Toutes")
    setActiveType("Tous")
  }

  function handleFamilyChange(family: string) {
    setActiveFamily(family)
    setActiveType("Tous")
  }

  return (
    <div>
      {/* Onglets principaux */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-border/40 pb-1">
        {SHEETS.map((sheet) => {
          const count = products.filter((p) => p.procitySheet === sheet).length
          return (
            <button
              key={sheet}
              onClick={() => handleSheetChange(sheet)}
              className={`relative px-5 py-3 text-sm font-bold uppercase tracking-wide transition-colors duration-200 cursor-pointer ${
                activeSheet === sheet
                  ? "text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-accent after:translate-y-[1px]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {sheet}
              {count > 0 && (
                <span className="ml-2 text-[10px] bg-secondary/60 text-muted-foreground px-1.5 py-0.5 rounded-full font-normal">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filtres en cascade */}
      <div className="flex flex-wrap gap-4 mb-8">
        {/* Dropdown Catégorie */}
        <div className="relative">
          <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1.5">
            Catégorie
          </label>
          <div className="relative">
            <select
              value={activeFamily}
              onChange={(e) => handleFamilyChange(e.target.value)}
              className="appearance-none bg-white border border-border/60 rounded-lg px-4 py-2.5 pr-9 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent cursor-pointer min-w-[220px]"
            >
              {families.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Dropdown Type de produit */}
        <div className="relative">
          <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1.5">
            Type de produit
          </label>
          <div className="relative">
            <select
              value={activeType}
              onChange={(e) => setActiveType(e.target.value)}
              disabled={types.length <= 1}
              className="appearance-none bg-white border border-border/60 rounded-lg px-4 py-2.5 pr-9 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent cursor-pointer min-w-[220px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Compteur résultats */}
        <div className="flex items-end pb-2.5">
          <span className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{filtered.length}</span> produit{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Grille produits */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium mb-2">Aucun produit trouvé pour cette sélection.</p>
          <button
            onClick={() => { setActiveFamily("Toutes"); setActiveType("Tous") }}
            className="text-accent hover:underline text-sm cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categorySlug={product.categorySlug ?? "procity"}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet"
npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/components/catalogue/procity-catalogue-client.tsx
git commit -m "feat: composant ProcityCatalogueClient avec onglets et filtres en cascade"
```

---

## Task 5 : Page serveur `/catalogue/procity`

**Files:**
- Créer : `src/app/catalogue/procity/page.tsx`

- [ ] **Step 1 : Créer la page**

Créer `src/app/catalogue/procity/page.tsx` :

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { getProcityProducts } from "@/lib/data"
import { ProcityCatalogueClient } from "@/components/catalogue/procity-catalogue-client"
import { ArrowLeft, Tag } from "lucide-react"

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Catalogue ProCity | SAPAL Signalisation",
  description: "Découvrez notre gamme complète de produits ProCity : mobilier urbain, aires de jeux, équipements sportifs et miroirs de sécurité. Devis sur mesure en 24h.",
  alternates: { canonical: "/catalogue/procity" },
}

export default async function CatalogueProcityPage() {
  const products = await getProcityProducts()

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* En-tête */}
      <section className="container px-4 md:px-6 mx-auto mt-6 mb-10">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/catalogue"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors"
          >
            <ArrowLeft size={15} /> Catalogue
          </Link>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
            <Tag size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="font-heading text-3xl md:text-4xl tracking-tight text-foreground mb-2">
              Catalogue ProCity
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
              Gamme complète de mobilier urbain, aires de jeux, équipements sportifs et miroirs de sécurité du fabricant ProCity®.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{products.length}</span> produit{products.length !== 1 ? "s" : ""} disponible{products.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </section>

      {/* Catalogue interactif */}
      <section className="container px-4 md:px-6 mx-auto">
        <ProcityCatalogueClient products={products} />
      </section>
    </div>
  )
}
```

- [ ] **Step 2 : Lancer le serveur de dev et vérifier la page**

```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet"
npm run dev
```

Ouvrir `http://localhost:3000/catalogue/procity`.

Vérifier :
- La page se charge sans erreur
- Le nombre de produits affiché correspond au `COUNT(*)` retourné à la Task 2 Step 4
- Les 4 onglets apparaissent (MOBILIER URBAIN, AIRES DE JEUX, ÉQUIPEMENTS SPORTIFS, MIROIRS)
- Les dropdowns Catégorie et Type se mettent à jour correctement en cliquant sur les onglets
- Les `ProductCard` s'affichent avec leur lien correct

- [ ] **Step 3 : Commit**

```bash
git add src/app/catalogue/procity/page.tsx
git commit -m "feat: page /catalogue/procity avec Server Component et filtres ProCity"
```

---

## Task 6 : Navigation — Header desktop + Mobile

**Files:**
- Modifier : `src/components/layout/header.tsx`
- Modifier : `src/components/layout/mobile-nav.tsx`

- [ ] **Step 1 : Ajouter le lien dans le header desktop**

Dans `src/components/layout/header.tsx`, dans la `<nav>` desktop, ajouter ce `<Link>` **après** le lien "Tous nos produits" et **avant** le lien "Signalisation" :

```tsx
<Link href="/catalogue/procity" className="relative py-3.5 px-5 text-muted-foreground hover:text-foreground transition-colors group">
  Catalogue ProCity
  <span className="absolute bottom-0 left-5 right-5 h-[2px] bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></span>
</Link>
```

- [ ] **Step 2 : Ajouter le lien dans la navigation mobile**

Dans `src/components/layout/mobile-nav.tsx`, modifier le tableau `NAV_LINKS` pour y ajouter l'entrée ProCity **après** `"Tous nos produits"` :

```typescript
const NAV_LINKS = [
  { href: "/catalogue", label: "Tous nos produits" },
  { href: "/catalogue/procity", label: "Catalogue ProCity" },
  { href: "/catalogue/signalisation", label: "Signalisation" },
  { href: "/catalogue/mobilier-urbain", label: "Mobilier Urbain" },
  { href: "/catalogue/amenagement-securite", label: "Aménagement & Sécurité" },
  { href: "/realisations", label: "Réalisations" },
  { href: "/contact", label: "Contact" },
]
```

- [ ] **Step 3 : Vérifier visuellement**

Avec le serveur de dev toujours lancé, vérifier sur `http://localhost:3000` :
- Desktop : le lien "Catalogue ProCity" apparaît dans la barre de nav entre "Tous nos produits" et "Signalisation"
- Mobile : ouvrir le menu hamburger, vérifier que "Catalogue ProCity" est dans la liste
- Cliquer sur le lien → redirection vers `/catalogue/procity` correcte

- [ ] **Step 4 : Commit**

```bash
git add src/components/layout/header.tsx src/components/layout/mobile-nav.tsx
git commit -m "feat: ajouter lien Catalogue ProCity dans la navigation header et mobile"
```

---

## Task 7 : Sitemap

**Files:**
- Modifier : `src/app/sitemap.ts`

- [ ] **Step 1 : Ajouter la route ProCity dans `staticPages`**

Dans `src/app/sitemap.ts`, ajouter cette entrée dans le tableau `staticPages`, après la ligne `/catalogue` :

```typescript
{ url: `${SITE_URL}/catalogue/procity`, changeFrequency: "weekly", priority: 0.85 },
```

- [ ] **Step 2 : Vérifier le sitemap**

```bash
# Avec le serveur de dev lancé :
curl http://localhost:3000/sitemap.xml | grep procity
```

Résultat attendu : une ligne contenant `catalogue/procity`.

- [ ] **Step 3 : Commit final**

```bash
git add src/app/sitemap.ts
git commit -m "feat: ajouter /catalogue/procity dans le sitemap"
```

---

## Vérification finale

Avec le serveur de dev lancé sur `http://localhost:3000` :

1. **Navigation** : le lien "Catalogue ProCity" est visible dans le header desktop et le menu mobile
2. **Page** : `/catalogue/procity` s'affiche avec le bon nombre de produits
3. **Onglets** : basculer entre les 4 onglets met à jour la grille
4. **Filtres** : sélectionner une catégorie filtre les produits ; sélectionner un type filtre davantage
5. **Réinitialisation** : revenir à "Toutes" / "Tous" dans les dropdowns réaffiche tous les produits de l'onglet
6. **État vide** : si un filtre ne donne aucun résultat, le message "Aucun produit trouvé" s'affiche avec le bouton de réinitialisation
7. **Fiche produit** : cliquer sur un `ProductCard` navigue vers la fiche existante `/catalogue/[categorySlug]/[productSlug]`
8. **Sitemap** : `/sitemap.xml` contient l'URL ProCity
