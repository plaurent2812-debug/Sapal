# Spec : Catalogue ProCity

**Date :** 2026-04-02
**Statut :** Approuvé

---

## Contexte

SAPAL Signalisation distribue des produits du fournisseur ProCity/Vialux. Ces produits sont déjà importés dans Supabase (mélangés aux autres produits) mais ne sont pas encore identifiables en tant que produits ProCity. L'objectif est de créer un espace dédié "Catalogue ProCity" accessible depuis le header, reflétant fidèlement la structure du tarif ProCity 2026.

---

## Structure du catalogue ProCity (source : tarifprocityvialux2026-fr.v1.7-699.xlsx)

4 onglets principaux, chacun avec des catégories (col C) et types de produits (col D) :

### MOBILIER URBAIN
- AMÉNAGEMENT DE LA RUE → ARCEAUX, BARRIÈRES DE VILLE, BORNES, COUSSIN BERLINOIS & PLOTS ROUTIERS, POTELETS
- ESPACES VERTS → BACS À PALMIER, BANCS ET BANQUETTES, BANCS ET TABLES ENFANTS, CORBEILLES DE PROPRETÉ, OPTIONS POUR BANCS…, PERGOLAS, PROTECTIONS, SOLUTIONS CONTENEURS, TABLES DE PIQUE-NIQUE, VASES
- INDUSTRIE ET TP → ARCEAUX, BARRIÈRES ET PASSERELLES, PROTECTIONS, PROTECTIONS D'ANGLES
- MAÎTRISE D'ACCÈS ET PARKING → ABRIS, BARRIÈRE AMOVIBLE, BARRIÈRES, PORTIQUES, PROTECTIONS, STATIONNEMENT
- PAVOISEMENT ET MATÉRIEL ÉLECTORAL → MATÉRIEL ÉLECTORAL, PAVOISEMENT
- SOLUTIONS FUMEURS → ABRIS FUMEURS, CENDRIERS
- SOLUTIONS VÉLOS & MOTOS → ABRIS SÉCURISÉS, ABRIS VÉLOS, ABRIS VÉLOS ET MOTOS, SUPPORTS ET APPUIS VÉLOS
- STATIONS BUS → CLAUSTRA POUR ABRIS, PIÈCES DÉTACHÉES…, STATION BUS CONVIVIALE®, STATION BUS KUB., STATION BUS MILAN, STATION BUS MODULO, STATION BUS PROVINCE, STATION BUS TURIN, STATION BUS VENISE, STATION BUS VOÛTE, TOTEM ARRÊT DE BUS ET ASSIS-DEBOUT
- VITRINES ET AFFICHAGE → AFFICHAGE EXTÉRIEUR, VITRINES EXTÉRIEURES, VITRINES INTÉRIEURES

### AIRES DE JEUX
- JEUX MULTI-ACTIVITÉS → JEUX MULTIFONCTIONS
- JEUX TRADITIONNELS → BACS À SABLE, BALANÇOIRES, CABANES, JEUX SUR RESSORT, JEUX À BASCULE, JEUX À GRIMPER, PANNEAUX LUDIQUE, TOBOGGANS, TOURNIQUET
- JEUX À GRIMPER ET D'ÉQUILIBRE → JEUX À GRIMPER, PARCOURS D'OBSTACLES, TYROLIENNE
- ÉQUIPEMENTS AIRES DE JEUX → CLÔTURE, PANNEAUX AGE

### ÉQUIPEMENTS SPORTIFS
- ÉQUIPEMENTS SPORTIFS → PARCOURS DE SANTÉ, PARCOURS DE SANTÉ EN BOIS

### MIROIRS
- ACCESSOIRES → ACCESSOIRES
- FABRICATIONS SPÉCIALES → FABRICATIONS SPÉCIALES
- MIROIRS DE SURVEILLANCE → MIROIRS, MIROIRS INTÉRIEURS
- MIROIRS INDUSTRIE ET LOGISTIQUE → MIROIRS EXTÉRIEURS, MIROIRS HÉMISPHÉRIQUES, MIROIRS INDUSTRIE ET LOGISTIQUE, MIROIRS INTÉRIEURS
- MIROIRS MULTI-USAGES → MIROIRS MULTI-USAGES
- MIROIRS RÉGLEMENTAIRES D'AGGLOMÉRATION → MIROIRS

---

## Modifications base de données

### Migration Supabase — nouvelles colonnes dans `products`

```sql
ALTER TABLE products
  ADD COLUMN supplier        text,
  ADD COLUMN procity_sheet   text,
  ADD COLUMN procity_family  text,
  ADD COLUMN procity_type    text;

CREATE INDEX idx_products_supplier ON products(supplier);
CREATE INDEX idx_products_procity_sheet ON products(procity_sheet);
CREATE INDEX idx_products_procity_family ON products(procity_family);
```

### Script de tagging des produits ProCity

Un script Node.js (à exécuter une seule fois) :
1. Charge le fichier Excel `tarifprocityvialux2026-fr.v1.7-699.xlsx`
2. Construit un mapping `référence → { sheet, family, type }`
3. Pour chaque ligne du fichier, cherche le produit en DB par `reference`
4. Met à jour `supplier='procity'`, `procity_sheet`, `procity_family`, `procity_type`

Les références ProCity sont des codes numériques (ex: `206200`, `800101`). La colonne `reference` dans `products` contient déjà ces valeurs pour les produits importés.

> Note : Les produits non matchés (référence absente en DB) sont ignorés — ils n'ont pas encore été importés.

---

## Page `/catalogue/procity`

### Route
`/catalogue/procity` — page Next.js Server Component avec partie client pour les filtres.

### Composants

**`ProcityCataloguePage`** (Server Component)
- Récupère tous les produits où `supplier = 'procity'` depuis Supabase
- Passe les données au composant client

**`ProcityCatalogueClient`** (Client Component)
- Onglets : MOBILIER URBAIN | AIRES DE JEUX | ÉQUIPEMENTS SPORTIFS | MIROIRS
- Dropdown "Catégorie" (procity_family) — options filtrées selon l'onglet actif
- Dropdown "Type de produit" (procity_type) — options filtrées selon la famille sélectionnée
- Grille de produits — réutilise le composant `ProductCard` existant
- État géré localement (useState) — pas de Zustand, pas d'URL params

**Comportement des filtres :**
- Sélectionner un onglet → réinitialise famille et type, affiche tous les produits de cet onglet
- Sélectionner une famille → réinitialise le type, filtre les produits par famille
- Sélectionner un type → filtre les produits par type
- "Tous" disponible dans chaque dropdown pour revenir à la sélection parent

### Données nécessaires

Nouvelle fonction dans `lib/data.ts` :
```ts
getProcityProducts(): Promise<ClientProduct[]>
// Retourne tous les produits où supplier = 'procity'
// Inclut procity_sheet, procity_family, procity_type dans le résultat
```

Et extension du type `ClientProduct` :
```ts
procitySheet?: string
procityFamily?: string
procityType?: string
```

Le type `ProductRow` dans `lib/supabase/types.ts` est également étendu avec ces 4 colonnes (`supplier`, `procity_sheet`, `procity_family`, `procity_type`).

**État vide :** Si aucun produit ne correspond aux filtres sélectionnés, afficher un message "Aucun produit trouvé pour cette sélection." dans la grille.

---

## Header

### Desktop (`header.tsx`)
Ajouter un lien "Catalogue ProCity" dans la `<nav>` desktop, positionné entre "Tous nos produits" et "Signalisation".

### Mobile (`mobile-nav.tsx`)
Ajouter le même lien dans la navigation mobile.

---

## Sitemap

Ajouter `/catalogue/procity` dans `sitemap.ts`.

---

## Ce qui n'est PAS dans le scope

- Import des produits ProCity non encore en BD (à faire séparément si besoin)
- Fiche produit ProCity spécifique (réutilise la fiche existante `/catalogue/[slug]/[productSlug]`)
- Affichage des prix (non affiché publiquement, uniquement sur devis)
- Gestion admin des tags ProCity (modification manuelle en admin panel)
