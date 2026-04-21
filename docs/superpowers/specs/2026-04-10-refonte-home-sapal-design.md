# Refonte esthétique de la page d'accueil SAPAL

**Date** : 2026-04-10
**Statut** : Spec de design validée — prête pour plan d'implémentation
**Auteur** : Pierre (validation) + Claude (rédaction)
**Direction retenue** : A+C « Navy & Terre » avec typographie IBM Plex

---

## 1. Contexte & motivation

### Problème

La page d'accueil actuelle (`src/app/page.tsx`) présente une esthétique B2B corporate générique (bleu marine + orange sur fond blanc, typographie Inter, hero asymétrique classique) qui ne différencie pas SAPAL de ses concurrents directs (SignalsDirect, Prozon, etc.). Les clients cibles (collectivités, services techniques, paysagistes, architectes) évoluent vers une culture visuelle plus éditoriale, et les marques de mobilier urbain premium (Tolix, Fermob, Area, Concept Urbain, TF Urban) ont toutes adopté des esthétiques éditoriales/architecturales ces dernières années.

### Objectif

Reconstruire la page d'accueil avec une **esthétique éditoriale premium** qui :

1. Différencie SAPAL instantanément de la concurrence B2B générique
2. Parle aux décideurs contemporains (élus, urbanistes, paysagistes) qui ont une culture visuelle exigeante
3. Valorise l'ancrage cannois et le patrimoine français du secteur
4. Évite les tics visuels des sites générés par IA (mots surlignés en couleur, gradients textuels, blobs flous, glassmorphism décoratif, étoiles, glow shadows)
5. Reste sérieuse et crédible pour du B2B à marché public (mandat administratif, devis, collectivités)

### Non-objectifs (YAGNI)

- **Pas de refonte du design system global** : seule la home est concernée dans ce premier spec. Les pages `/catalogue`, `/contact`, `/admin`, etc. restent inchangées pour l'instant.
- **Pas de nouveaux composants de données** : on réutilise `getCategories()`, `getFeaturedProducts()`, `getProductsCount()` déjà existants dans `src/lib/data.ts`.
- **Pas de migration Tailwind ou de changement de stack** : Next.js 16 / Tailwind CSS 4 / React 19 restent identiques.
- **Pas d'internationalisation** : français uniquement, comme le reste du site.

---

## 2. Direction esthétique « Navy & Terre »

Hybride entre une évolution de l'ADN actuel (bleu marine conservé) et une refonte de la palette périphérique vers des tons minéraux chaleureux.

### 2.1 Palette

| Token | Valeur hex | OKLCH approximé | Usage |
|---|---|---|---|
| `--navy` | `#0f1e3a` | `oklch(0.20 0.08 260)` | Fond principal sombre (header, bands, CTA final, encart hero), couleur de texte principal sur fond crème |
| `--navy-2` | `#1e3a5f` | `oklch(0.32 0.09 260)` | Variation plus claire pour survols ou dégradés subtils éventuels |
| `--cream` | `#f2ece0` | `oklch(0.94 0.02 80)` | Fond page (remplace le blanc pur), fond sections claires |
| `--cream-2` | `#f8f4ec` | `oklch(0.96 0.015 80)` | Fond cartes sur cream, états alternatifs subtils |
| `--terra` | `#c2410c` | `oklch(0.56 0.18 40)` | Accent principal (CTAs, kickers mono, tag produits, cercles décoratifs) |
| `--terra-2` | `#9a3412` | `oklch(0.46 0.16 40)` | Variante plus sombre (hover CTA, kickers sur fond clair) |
| `--stone` | `#d4c7a8` | `oklch(0.84 0.04 80)` | Texte secondaire sur fond navy, bordures subtiles navy-sur-navy |
| `--ink` | `#1c1917` | `oklch(0.18 0.01 60)` | Corps de texte sur fond crème, footer |
| `--muted` | `#78716c` | `oklch(0.54 0.01 60)` | Texte tertiaire, numéros de chapitre, meta |

**Remplacement dans `src/app/globals.css`** : ces tokens viennent écraser les `--background`, `--primary`, `--accent`, `--secondary` existants. Le mode dark n'est pas modifié dans ce spec (la home publique reste en mode clair).

### 2.2 Typographie — Famille IBM Plex

Toutes les polices sont libres et chargées via `next/font/google`.

| Famille | Usage | Graisses chargées |
|---|---|---|
| **IBM Plex Serif** | Tous les titres (h1, h2, h3, nombres géants, noms de catégorie, noms de produit, logo) | 400 (regular), 500 (medium), 600 (semibold) |
| **IBM Plex Sans** | Corps de texte, paragraphes, boutons, navigation, descriptions | 400, 500, 600 |
| **IBM Plex Mono** | Kickers, labels de chapitre, numérotation (N° 01, 01/09), références produits, meta, badges | 400, 500, 600 |

**Pourquoi cette famille** : cohérence totale (une seule fonderie, un seul œil), feeling « spécimen technique / documentation d'architecte » qui colle au métier de la signalisation, sobriété qui évite les excès éditoriaux tout en apportant du caractère.

**Note sur le logo** : le logo SAPAL existant (`public/logo.png`, disque noir avec route stylisée blanche + texte « SAPAL SIGNALISATION ») est **conservé et réutilisé tel quel**. Dans les mockups de brainstorming, j'ai utilisé « SAPAL » en texte Plex Serif comme placeholder, mais l'implémentation consommera le vrai logo via `next/image`. La forme circulaire du logo devient un argument fort de cohérence visuelle : les cercles décoratifs du hero et du band « En chiffres » ne sont plus seulement une référence aux panneaux ronds de signalisation routière, ils **rappellent aussi directement la forme du logo**, créant un système visuel auto-référentiel cohérent.

**Règle d'or** : aucun mot ne reçoit de couleur différente dans un titre. La hiérarchie se fait uniquement par :
- Contraste de graisse (Plex Serif 400 ↔ 600 dans un même titre)
- Retours à la ligne composés
- Kickers mono terracotta positionnés au-dessus du titre
- Éléments décoratifs latéraux (encart visuel, cercles)

### 2.3 Système d'espacement et de grille

- **Container max-width** : 1280px, marges latérales `px-10` (40px) sur desktop, `px-6` (24px) sur mobile
- **Sections verticales** : `py-20` à `py-24` sur desktop (80-96px), `py-14` sur mobile
- **Grille catégories** : 4 colonnes desktop, 2 colonnes tablette, 2 colonnes mobile, gap `4px` (cartes serrées avec séparations nettes comme une grille de spécimen)
- **Grille produits** : 4 colonnes desktop, 2 colonnes tablette, 1 colonne mobile, gap `24px`
- **Rayons** : 2-4px maximum partout. Pas d'arrondis « pills » (rounded-xl, rounded-2xl supprimés)

### 2.4 Principes de composition anti-IA

**Bannis** (pas de justification fonctionnelle) :
- Mots surlignés en couleur dans les titres
- Mots soulignés décoratifs dans les titres
- Gradients appliqués au texte
- Blobs flous en arrière-plan (le `blur-3xl` des cercles actuels est supprimé)
- Glow shadows colorés sous les CTAs (shadow-accent/20 → shadow sobre noire uniquement)
- Glassmorphism décoratif (bg-white/5 + backdrop-blur sans usage fonctionnel)
- Emojis dans les titres
- Étoiles « ✨ »
- Illustrations 3D abstraites stock
- Barres « Rejoignez 10 000+ clients »

**Conservés** (usage fonctionnel) :
- Grilles (structurent l'information)
- Ombres discrètes au hover (signalent la cliquabilité)
- Animations scroll sobres via `AnimatedSection` existant (guident l'attention)
- Cercles décoratifs latéraux en hero et en band — car ils évoquent visuellement les panneaux ronds de signalisation routière (auto-référentiel au métier, pas décoratif gratuit)
- Motifs diagonaux subtils (évoquent les marquages de chantier)

---

## 3. Structure de la page d'accueil

La page est organisée en **7 sections** enchaînées, toutes avec un système de « chapitres » éditorial (« Sommaire · Chapitre 01 », « Chapitre 02 · En chiffres », etc.) qui crée un fil narratif cohérent.

### 3.1 Header & navigation (global — existe déjà)

**Portée** : le header est géré par `src/components/layout/header.tsx` et ne fait pas partie de cette refonte. Le **logo SAPAL** (`public/logo.png`, disque noir avec route stylisée + « SAPAL SIGNALISATION ») est **conservé tel quel** — aucune modification du logo. Les seules adaptations nécessaires :
- Fond navy à la place du fond primary actuel
- CTAs passent sur terracotta à la place d'orange
- Liens de navigation consomment les nouveaux tokens de couleur
- Topbar (si présente) passe sur navy ou ink selon le rendu

Ces adaptations sont considérées comme un effet de bord nécessaire — à traiter dans le plan d'implémentation comme un sous-ticket de mise à jour mécanique des classes Tailwind. **Le logo n'est ni redessiné, ni remplacé par du texte — il reste l'image existante.**

### 3.2 Hero

**Layout** : grille 2 colonnes desktop (ratio 1.3 / 1), empilé mobile.

**Colonne gauche** :
- Kicker mono terracotta : `ÉDITION COLLECTIVITÉS · PRINTEMPS 2026` (statique ou dynamique selon saison, à figer en constante pour l'instant)
- H1 Plex Serif 72px (desktop) / 40px (mobile), weight 400 et 600 : `L'excellence au service des collectivités françaises.` — le mot « collectivités » est en weight 600, tout en `--navy`
- Paragraphe d'intro Plex Sans 16px, max 440px, `--ink/80` : `335 références de mobilier urbain, signalisation et équipements d'espaces publics. Conçus, fabriqués et livrés depuis Cannes.` (chiffre dynamique depuis `getProductsCount()`)
- Deux CTAs côte à côte : primary terracotta `Explorer le catalogue →` (lien `/catalogue`), secondary outline navy `Devis sur mesure` (lien `/contact`)

**Colonne droite** (encart visuel navy) :
- Fond `--navy`, padding `32px`, hauteur fixe 440px desktop
- Deux cercles concentriques en bordure terracotta (1.5-2px) positionnés en décalage top-right, opacités 0.25 et 0.5 (évoquent les panneaux ronds de signalisation)
- Label mono stone : `N° 01 · CATALOGUE`
- Grand nombre Plex Serif 120px, weight 500, couleur cream : `335` (dynamique depuis `getProductsCount()`)
- Sous-titre Plex Sans 13px stone : `références certifiées NF/CE, réparties en 9 catégories pour équiper l'espace public.`
- Footer de carte aligné en bas avec séparateur fin : `MOBILIER · SIGNALISATION` (gauche) et `NF / CE` (droite), en mono 10px stone

**Animations** : `AnimatedSection delay={0.1}` sur le kicker, `delay={0.2}` sur le h1, `delay={0.3}` sur le paragraphe, `delay={0.4}` sur les CTAs, `delay={0.3}` sur l'encart visuel entier.

### 3.3 Barre de réassurance

**Layout** : 4 colonnes égales desktop, 2×2 mobile, fond `--navy`, padding `py-7` (28px).

**4 items** avec séparateurs verticaux fins `border-r border-cream/10`. Tous les numéros (01-04) sont en Plex Mono 10px weight 600 couleur `--terra`, letter-spacing 0.12em.

| N° | Titre (Plex Serif 500, cream, 19px) | Sous-titre (Plex Sans 400, stone, 11px uppercase) |
|---|---|---|
| `01` | Livraison rapide | France entière |
| `02` | Qualité certifiée | Normes NF / CE |
| `03` | Devis sous 3h | Gratuit & sans engagement |
| `04` | Mandat administratif | Paiement à 30 jours |

**Suppression** : les icônes Lucide (`Truck`, `ShieldCheck`, `CheckCircle2`, `MapPin`) dans des cercles accent/10 du design actuel sont **retirées**. La numérotation mono remplace l'iconographie.

### 3.4 Catégories

**Layout** : section `py-22` sur fond `--cream`.

**Header de section** en grille 2 colonnes :
- Gauche : kicker mono terracotta `SOMMAIRE · CHAPITRE 01` + H2 Plex Serif 52px `Neuf catégories, un catalogue complet.` (le mot « complet » en weight 600)
- Droite : paragraphe descriptif Plex Sans 14px + lien mono souligné `VOIR TOUT LE CATALOGUE →`
- Séparateur horizontal fin navy/15 en dessous

**Grille catégories** : 4 colonnes desktop × 2 lignes, 2×4 tablette, 2×4 mobile. Gap `4px` (volontairement serré pour évoquer une grille de spécimen). On affiche les 8 premières catégories de `getCategories()` (la 9e apparaît implicitement via la numérotation « 08 / 09 »).

**Chaque carte de catégorie** :
- Fond `--cream-2`, bordure `rgba(ink, 0.08)`, padding `28px 20px`, min-height 180px
- Numéro mono muted en haut : `01 / 09`, `02 / 09`, etc.
- Nom de catégorie en bas en Plex Serif 22px weight 500, aligné en bas via `mt-auto` + flex column
- Meta en ligne en bas : compteur produits mono muted (`48 réf.`) + flèche `→` à droite
- **Hover** : inversion fond → `--navy`, tout le texte → `--cream`, flèche → `--terra`, transition 0.3s

**Suppression** : plus d'image de catégorie dans les vignettes. Le design est purement typographique — la hiérarchie visuelle vient de la numérotation, du nom en serif, et du traitement de la grille. (Ça simplifie aussi l'absence actuelle d'images réelles SAPAL — voir todo.md 7.1.)

### 3.5 Band « En chiffres »

**Layout** : section full-bleed navy (fond `--navy` bord à bord de la viewport), `py-20` (80px). À l'intérieur, un container 1280px max centré avec padding latéral identique aux autres sections (`px-10` desktop / `px-6` mobile).

**Container interne** : grille 2 colonnes (ratio 1 / 2) alignées centrées.

**Colonne gauche** :
- Kicker mono terra : `CHAPITRE 02 · EN CHIFFRES`
- H3 Plex Serif 40px cream : `Sept ans au service des collectivités.` (« collectivités » en weight 600)

**Colonne droite** : grille 3 colonnes séparées de la gauche par un border-left stone/20, padding-left 48px :
- `335` (dynamique) — label : `RÉFÉRENCES CATALOGUE`
- `3h` — label : `DÉLAI DE DEVIS`
- `7 ans` — label : `D'EXPÉRIENCE`

Chaque nombre en Plex Serif 76px weight 500, unité en 32px terracotta weight 500. Label en mono 10px stone avec border-top stone/20 et padding-top 12px.

**Décorations** : deux grands cercles concentriques en bordure terracotta (opacités 0.15 et 0.3) positionnés en absolu à droite, débordant partiellement hors de la section. Évocation directe des panneaux ronds.

**Animation** : `AnimatedCounter` existant réutilisé pour les 3 nombres.

### 3.6 Produits phares

**Layout** : section `py-22` sur fond `--cream`, même pattern de header de section que les catégories.

**Header** :
- Kicker : `SOMMAIRE · CHAPITRE 03`
- H2 : `La sélection du moment.` (« moment » en weight 600)
- Paragraphe droite : `Les produits les plus demandés par nos clients ce trimestre — sélectionnés pour leur rapport qualité/prix et leur disponibilité immédiate.`
- Lien : `TOUTE LA SÉLECTION →`

**Grille produits** : 4 colonnes desktop, 2 colonnes tablette, 1 colonne mobile, gap 24px. Réutilise `getFeaturedProducts(4)`.

**Carte produit — nouveau composant `ProductCardEditorial`** (à créer, ne remplace pas `ProductCard` utilisé ailleurs) :
- Fond blanc pur (contraste volontaire avec le fond cream de la section), bordure ink/8
- Zone image 160px hauteur, fond cream-2, bordure-bottom ink/8
- Tag optionnel en haut-gauche de l'image (`NOUVEAU`, `POPULAIRE`) : fond navy, texte cream, mono 9px
- Body padding 18-20px
- Catégorie en mono 9px uppercase muted
- Nom produit en Plex Serif 19px weight 500, 2 lignes max
- Footer avec border-top ink/8 : référence mono muted à gauche (`REF. MU-042`), lien mono terracotta à droite (`VOIR →`)
- Hover : translate-y -2px + shadow sobre noire (pas de glow coloré)

### 3.7 CTA final

**Layout** : full-bleed, fond `--navy`, `py-25` (100px), container interne centré max 1000px.

**Contenu centré** :
- Kicker mono terra avec traits latéraux : `— CHAPITRE 04 · VOTRE PROJET —`
- H2 Plex Serif 62px cream weight 400 : `Un projet d'aménagement urbain ?` (« urbain ? » en weight 600)
- Paragraphe Plex Sans 16px stone, max 560px centré : `Nos experts vous accompagnent de la conception à la livraison. Obtenez votre devis personnalisé sous 3 heures, gratuit et sans engagement.`
- Deux CTAs centrés : primary terracotta `Demander un devis →` (lien `/contact`), secondary outline stone `Parcourir le catalogue` (lien `/catalogue`)

**Décoration de fond** : motif de rayures diagonales très subtil (`rgba(terra, 0.03)` 45°) sur une bande verticale à gauche uniquement — évocation des barrières Vauban / rubans de chantier, auto-référentiel au métier. Aucun blob flou, aucun cercle superposé ici (variation par rapport au hero pour éviter la répétition décorative).

### 3.8 Footer (global — existe déjà)

Hors scope de ce spec, mais comme le header, s'assurer qu'il consomme bien les nouveaux tokens navy/cream/terra. Sous-ticket dans le plan d'implémentation.

---

## 4. Composants à créer ou modifier

### À créer

1. **`src/components/home/HeroEditorial.tsx`** — le nouveau hero éditorial avec encart navy et cercles décoratifs
2. **`src/components/home/ReassuranceBar.tsx`** — la barre de réassurance navy numérotée (4 items)
3. **`src/components/home/CategoriesEditorial.tsx`** — la section catégories avec header 2 colonnes et grille de spécimen
4. **`src/components/home/StatsBand.tsx`** — le band navy « En chiffres » avec cercles décoratifs
5. **`src/components/home/FeaturedEditorial.tsx`** — la section produits phares avec header 2 colonnes
6. **`src/components/home/ProductCardEditorial.tsx`** — la carte produit éditoriale (nouveau, ne remplace pas `ProductCard`)
7. **`src/components/home/CtaFinalEditorial.tsx`** — le CTA final navy avec rayures subtiles

### À modifier

1. **`src/app/globals.css`** — le projet utilise Tailwind CSS 4, donc la configuration des tokens se fait en inline `@theme` dans ce fichier. Remplacer les tokens `--primary`, `--accent`, `--secondary`, `--background`, `--foreground` existants par les nouveaux tokens `--navy`, `--navy-2`, `--cream`, `--cream-2`, `--terra`, `--terra-2`, `--stone`, `--ink`, `--muted`. Mapper également les nouvelles familles de polices `--font-serif` (IBM Plex Serif), `--font-sans` (IBM Plex Sans), `--font-mono` (IBM Plex Mono). Garder le bloc `.dark {}` intact pour l'admin — le mode clair est la seule cible de cette refonte.
2. **`src/app/layout.tsx`** — charger IBM Plex Serif, IBM Plex Sans, IBM Plex Mono via `next/font/google` avec `display: 'swap'`, exposer les variables CSS `--font-serif`, `--font-sans`, `--font-mono` sur le `<html>` ou `<body>`. Retirer les fonts actuelles (Inter, Fraunces, etc.) si elles ne sont plus utilisées ailleurs dans le projet.
3. **`src/app/page.tsx`** — remplacer le JSX actuel par la composition des 7 nouveaux composants home, en conservant les appels data `getCategories()`, `getFeaturedProducts(4)`, `getProductsCount()` et le JSON-LD Organization
4. **`src/components/layout/Header.tsx`** et **`src/components/layout/Footer.tsx`** — adapter les classes Tailwind consommant les anciens tokens pour pointer vers les nouveaux (navy à la place de primary, terra à la place de accent, cream à la place de white/background)

### Composants préservés (utilisés tels quels)

- `AnimatedSection`, `AnimatedItem`, `AnimatedCounter` (`src/components/ui/motion.tsx`)
- `ProductCard` existant (pour les autres pages — `/catalogue`, `/recherche`, etc.)
- Toute la data layer `src/lib/data.ts`

---

## 5. Responsive

### Desktop (≥1024px)

Tous les mockups sont pensés à cette largeur. Container 1280px max.

### Tablette (768-1023px)

- Hero : grille 2 colonnes conservée mais ratios ajustés, h1 56px
- Réassurance : 4 colonnes conservées, padding réduit
- Catégories : 2 colonnes × 4 lignes
- Band chiffres : 2 colonnes (texte au-dessus, stats en dessous), stats en 3 colonnes sous le texte
- Produits : 2 colonnes × 2 lignes

### Mobile (<768px)

- Hero : une seule colonne, encart navy sous le texte, h1 40px, bouton primary full-width, secondary en dessous
- Réassurance : grille 2 × 2
- Catégories : grille 2 colonnes × 4 lignes
- Band chiffres : texte au-dessus, 3 stats en colonne (pas en ligne) pour conserver la taille 76px lisible
- Produits : une seule colonne
- CTA final : titre 36px, boutons full-width empilés

---

## 6. Accessibilité

- **Contrastes** : navy `#0f1e3a` sur cream `#f2ece0` = ratio 13.2:1 (AAA). Cream sur navy identique. Terracotta `#c2410c` sur cream = 4.7:1 (AA large text, AA normal text). Stone `#d4c7a8` sur navy = 7.8:1 (AAA).
- **Focus states** : tous les liens et boutons conservent un `focus-visible:outline` en terracotta 2px offset 2px
- **Navigation clavier** : les cartes catégories et produits sont des `<Link>` Next.js natifs, l'ordre de tabulation suit l'ordre visuel
- **Skip link** existant conservé
- **ARIA** : `aria-labelledby` sur chaque section comme aujourd'hui, labels descriptifs

---

## 7. Performance

- Polices IBM Plex chargées via `next/font/google` avec `display: 'swap'` et preload uniquement des graisses réellement utilisées (400, 500, 600 par famille)
- Aucune nouvelle image ajoutée (les images catégories sont supprimées du design, cf. 3.4)
- Animations `AnimatedSection` existantes réutilisées — pas de nouveau package, pas de nouveau wrapper motion
- Structure DOM simplifiée par rapport à l'actuelle (suppression des icônes décoratives, des blobs, des gradients)

---

## 8. SEO & metadata

Conservés à l'identique :
- `metadata` title et description du fichier actuel
- `alternates.canonical`
- JSON-LD Organization
- Structure sémantique (`<section aria-labelledby>`, `<h1>` unique, hiérarchie h2/h3)

---

## 9. Hors scope explicite

- Pages autres que `/` (admin, catalogue, contact, qui-sommes-nous, etc.) — restent en l'état
- Mode dark — non traité dans ce spec
- Traductions / i18n — français uniquement
- Refonte du design system `shadcn/ui` — on garde les composants ui existants
- Ajout de nouveaux produits ou données — on consomme la data existante
- Images produits réelles (voir todo.md 7.1, tâche indépendante)
- Notifications Telegram / Resend — aucun impact
- Admin panel — aucun impact

---

## 10. Critères de validation

La refonte sera considérée comme réussie quand :

1. ✅ La page `/` affiche les 7 sections décrites (hero, réassurance, catégories, band chiffres, produits, CTA final, footer)
2. ✅ Tous les titres sont en IBM Plex Serif, corps en Plex Sans, kickers/labels en Plex Mono
3. ✅ Aucun mot surligné en couleur dans les titres (contraste par graisse uniquement)
4. ✅ Palette navy/cream/terra/stone/ink appliquée partout
5. ✅ Responsive validé sur 1440px, 1024px, 768px, 375px
6. ✅ Contrastes WCAG AA minimum sur tous les couples texte/fond
7. ✅ Les données dynamiques (nombre de produits, catégories, produits phares) s'affichent correctement
8. ✅ Les liens mènent bien à `/catalogue`, `/contact`, `/catalogue/[slug]`, `/catalogue/[slug]/[productSlug]`
9. ✅ Les animations `AnimatedSection` se déclenchent au scroll
10. ✅ Aucune régression sur le header, le footer, les autres pages

---

## 11. Références visuelles

Les mockups de brainstorming sont conservés dans `.superpowers/brainstorm/84219-1775852943/content/` pour référence :
- `four-directions.html` — les 4 directions initiales proposées
- `c-refinements-v2.html` — les 3 calibrations de la direction C validée
- `typography-options.html` — les 4 combinaisons typographiques proposées
- `full-homepage-ac-plex.html` — le mockup complet final validé (source de vérité visuelle)

Marques du secteur utilisées comme références d'ancrage esthétique : Tolix, Fermob, Area (mobilier urbain italien), Concept Urbain, TF Urban.

---

## 12. Décisions tranchées

| Décision | Choix | Justification |
|---|---|---|
| Direction esthétique | A+C Navy & Terre | Garde l'ADN bleu marine rassurant, introduit une chaleur minérale qui différencie du B2B générique |
| Typographie | IBM Plex Family | Cohérence totale (une fonderie), feeling spécimen technique cohérent avec le métier, évite le côté « magazine chic » trop distinctif |
| Mots colorés dans titres | Interdits | Tic visuel d'IA générative — remplacés par contraste de graisse 400↔600 |
| Icônes Lucide réassurance | Supprimées | Remplacées par numérotation mono, plus éditorial |
| Images catégories | Supprimées | Le design est purement typographique, évite aussi la dépendance aux images placeholder |
| Mode dark | Hors scope | À traiter dans un spec ultérieur si besoin |
| Composant produit | Nouveau `ProductCardEditorial` | N'impacte pas les autres pages qui continuent d'utiliser `ProductCard` |
| Structure éditoriale | Chapitres numérotés | Crée un fil narratif cohérent, renforce le parti-pris éditorial, justifie la typographie |
| Logo | Conservé tel quel (`public/logo.png`) | Le logo circulaire existe déjà et est reconnu — pas de refonte d'identité, uniquement refonte esthétique du site |
| Fonctionnalités | Aucune modification | Refonte purement esthétique, toute la data layer, les API, l'admin, l'auth, le SEO, les PDF, la PWA restent intacts |

---

**Fin de la spec.** Prêt pour rédaction du plan d'implémentation.
