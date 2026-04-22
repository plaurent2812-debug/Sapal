# SAPAL — Todo

_Dernière mise à jour : 21/04/2026_

---

## 🔄 EN COURS — Procity : dédup catalogue par URL (21/04/2026)

**Problème** : chaque ref Excel crée un produit séparé, donc 12× "Barrière Héritage" dans le catalogue/recherche au lieu d'1 produit avec variantes.

**Cible** : 1 produit par URL Procity → toutes les refs partageant l'URL deviennent des variantes (longueur × crosse × structure × coloris). Les produits sans URL restent individuels.

### Étapes

- [x] 1. **Refactor `db-writer.ts`** : accepter liste `ProductFromExcel[]` partageant même URL, créer 1 seul produit canonique (slug sans ref numérique), fusionner toutes les variantes Excel + snapshot
- [x] 2. **Extraire axes depuis Excel** : longueur (= dimensions), crosse (= finition "SANS/SIMPLE/DOUBLE CROSSE"), structure (suffixe designationFull "SIMPLE CROIX" / "AVEC ROSACE")
- [x] 3. **Matcher snapshot ↔ ref Excel** : croiser attributs pour assigner `primary_image_url` par variante (couleur × longueur × structure × crosse)
- [x] 4. **Orchestrateur `import/index.ts`** : grouper par URL avant upsert, passer le batch
- [x] 5. **Étendre `VariantSelector`** : supporter 4 axes dynamiques (Couleur + Longueur + Crosse + Structure)
- [x] 6. **Wipe products Procity non liés au devis test + re-import 50 URLs** → 50 groupes, 1070 variantes OK
- [x] 7. **QA navigateur Heritage** : 29 produits uniques sur amenagement-rue, fiche = 1 Heritage avec 4 sélecteurs, ref 206143 + 140,00 € après sélection rouge+1500+SimpleCrosse+AvecRosace

### Reste à faire (prochaine passe)
- [ ] Filtrer galerie produit (actuellement toutes les 60+ images scrapées affichées)
- [ ] Harmoniser casse variantes ("Simple Crosse" vs "Simple crosse")
- [ ] Scraper les 528 URLs restantes (~1991 produits complets)
- [ ] QA sur 20 fiches aléatoires

---

## ✅ FAIT — Hiérarchie catégories à 3 niveaux (21/04/2026)

Taxonomie Procity fidèle à l'Excel : 4 univers → 20 catégories → 73 types.

- [x] Migration : `parent_id`, `level`, `universe`, `sort_order` sur `categories` + contrainte unique par parent
- [x] Parser Excel étendu à l'onglet MIROIRS
- [x] Script `seed-categories.ts` idempotent (réutilise IDs 1/12/13/14 pour univers = catégories SAPAL existantes)
- [x] `db-writer.ts::resolveCategoryId` : résout au niveau 3 (type) avec fallback cat/univers
- [x] `data.ts` : `getCategories` → racines seules, ajouts `getCategoryChildren` + `getProductsInCategoryTree`
- [x] Page `/catalogue/[slug]` : cards sous-catégories si enfants, produits sinon
- [x] 2 produits test rattachés à leur sous-catégorie (Abris / Abris vélos)
- [x] Re-import 50 groupes avec nouveaux category_id

### Reste à peaufiner
- [x] Casse des noms types (ex: "Industrie et Tp" → "Industrie et TP") — `titleCase` refait en sentence-case + acronymes + noms propres
- [x] Slug univers Miroirs aligné sur Procity (`miroirs` au lieu de `miroirs-securite`)
- [x] Catalogue racine : 4 univers Procity purs (SAPAL legacy masqués via filtre `universe NOT NULL`)
- [x] Vignettes catégorie dynamiques via `getCategoryThumbnails` (image produit descendant)
- [x] Cards produit catalogue épurées (suppression Type/Poids/Description)
- [x] Scrape complet des 578 URLs → 531 OK, 14 fail (pièces détachées sans ref)
- [x] Import complet → 565 produits Procity, 7 445 variantes
- [x] Fix slug unique : suffixe avec ref en cas de collision
- [x] Nettoyage doublon 529777 (test) vs 1001 (original)
- [x] Importer Aires de jeux (190) / Miroirs (176) / Équipements sportifs (41) depuis Excel (sans URL Procity, donc sans photos variantes)
- [ ] Corriger 14 fails scraper (pièces détachées sans ref extracteur)
- [ ] Ajouter photos pour Aires de jeux / Miroirs / Éq. sportifs (à chercher sur procity.eu / vialux.fr manuellement ou via scraper page-catégorie)

---

## ✅ FAIT (historique)

_(voir git log pour détail complet)_

- [x] Design, catalogue, recherche full-text, variantes produits
- [x] Espace client (inscription, connexion, devis, commandes, factures, profil)
- [x] Admin CRUD (produits, catégories, fournisseurs, clients, devis, commandes)
- [x] Génération PDF devis + BDC + Chorus Pro (jsPDF)
- [x] Intégrations : Resend, Telegram, Pennylane (stub)
- [x] Flux commandes v2 : awaiting_bc → upload BC → supplier_orders → BDC fournisseur
- [x] Statuts `ordered`, `shipped`, `proforma_sent` ajoutés (migration 012 + 013)
- [x] Fix délai livraison : affichage jours/semaines selon valeur DB
- [x] Fix product card : "Voir le produit" à la place de "Ajouter au devis"
- [x] Email gérant : bouton "Voir dans mon espace Gérant"
- [x] Route upload-bc : email gérant ajouté à réception BC

---

## 🔄 EN COURS

### Couche Rôles — Espace Gérant
_Lancé en sous-agent le 09/04/2026_

**Objectif :** Créer un espace `/gerant` distinct de `/admin` avec accès métier uniquement.

| Fonctionnalité | Admin (OptiPro) | Gérant (SAPAL) |
|---|---|---|
| Catalogue / produits / prix / photos | ✅ | ❌ |
| Fournisseurs | ✅ | ❌ |
| Clients | ✅ | ❌ |
| Dashboard CA | ✅ | ✅ |
| Devis | ✅ | ✅ |
| Commandes | ✅ | ✅ |
| Factures | ✅ | ✅ |
| Prépaiements | ✅ | ✅ |

**Tâches :**
- [x] Rôle `gerant` dans Supabase (`user_metadata.role = 'gerant'`)
- [x] Layout `/gerant` avec nav restreinte
- [x] Page `/gerant/dashboard` — CA du mois, filtrable par client/période
- [x] Page `/gerant/devis` — liste + détail
- [x] Page `/gerant/commandes` — liste + détail
- [x] Page `/gerant/factures` — liste + téléchargement
- [x] Page `/gerant/prepaiements` — supplier_orders nécessitant un virement
- [x] Middleware : protéger `/gerant/*` → rôle `gerant` uniquement
- [x] Middleware : bloquer `/admin/*` pour le gérant (rediriger vers `/gerant`)
- [x] RLS : `gerant` autorisé sur devis, commandes, supplier_orders, factures (migration 013)
- [x] Notif Telegram + email gérant dès qu'un prépaiement est requis
- [ ] Dashboard admin : mêmes métriques CA
- [ ] Créer le user gerant dans Supabase Auth (via dashboard ou CLI)

---

## 📋 À FAIRE

### Test parcours client — suite (Étape 6 → 10)
- [ ] Étape 6 : Admin voit la commande + supplier_order Procity
- [ ] Étape 7 : Admin marque la commande fournisseur comme expédiée
- [ ] Étape 8 : Admin marque la commande client comme livrée
- [ ] Étape 9 : Admin génère la facture
- [ ] Étape 10 : Client consulte sa facture dans l'espace client

### Test parcours fournisseur
- [ ] Flux 30j (Procity) : BDC direct → expédition → livraison
- [ ] Flux prépaiement (Signaux Girod) : proforma → gérant paie → BDC → expédition

### Données produits
- [ ] Assigner `supplier_id` à tous les produits (actuellement null — bloque la création de supplier_orders)
- [ ] Interface admin pour gérer le fournisseur d'un produit (champ dans la fiche produit)

### Images produits
- [ ] Remplacer images placeholder par vraies photos (en cours côté client SAPAL)

### 🚨 GO-LIVE — Bascule notifications test → prod

**Règle en vigueur pendant les tests :** TOUTES les notifications (emails Resend + Telegram) arrivent sur Pierre Laurent / OptiPro (`p.laurent@opti-pro.fr` / chat Telegram `5721158019`). C'est volontaire pour valider les contenus.

**Le jour où Pierre dit « on passe en prod » / « on lance officiellement » / « on met en ligne »**, appliquer CETTE CHECKLIST DANS L'ORDRE :

- [ ] **1. Récupérer auprès du gérant SAPAL** :
  - [ ] Son email de réception des notifs
  - [ ] Son chat ID Telegram (lui faire ouvrir le bot `@…`, envoyer `/start`, puis récupérer le chat ID via `https://api.telegram.org/bot<TOKEN>/getUpdates`)
- [ ] **2. Refactor du `to:` hardcodé dans `src/app/api/contact/route.ts:78`** — remplacer `'p.laurent@opti-pro.fr'` par `process.env.SAPAL_GERANT_EMAIL` (ou créer `SAPAL_CONTACT_EMAIL` si on veut séparer)
- [ ] **3. Basculer les variables Vercel** (Production + Preview) :
  - [ ] `SAPAL_GERANT_EMAIL` → email du gérant SAPAL
  - [ ] `TELEGRAM_CHAT_ID` → chat ID du gérant SAPAL
  - [ ] `RESEND_FROM_EMAIL` → vérifier que le domaine `@sapal.fr` est validé dans Resend (sinon garder `@opti-pro.fr` le temps de valider le DNS)
  - [ ] `NEXT_PUBLIC_SITE_URL` → `https://www.sapal.fr` (ou le domaine final)
- [ ] **4. Redéployer** (un simple changement de var ne suffit pas — relancer le build)
- [ ] **5. Test de non-régression immédiat** :
  - [ ] Envoyer un message via le formulaire `/contact` → vérifier qu'il arrive chez le gérant SAPAL (pas chez Pierre)
  - [ ] Créer un devis depuis un compte client test + l'accepter → vérifier email + Telegram chez le gérant
  - [ ] Uploader un BC test → vérifier email + Telegram chez le gérant
- [ ] **6. Confirmer avec Pierre** que rien ne lui arrive plus (c'est le signal que la bascule est propre)

⚠️ **L'admin (OptiPro / Pierre) ne reçoit RIEN en prod** — c'est un rôle de gestion, pas un destinataire. Ne jamais ajouter de `SAPAL_ADMIN_EMAIL` ou de logique de notification admin.

### Mise en production (autres tâches)
- [ ] Tests sur déploiement preview Vercel
- [ ] PR → merge main → production

### Divers
- [ ] Telegram : 4 channels distincts (Devis, Paiements, Commandes, Contact)
- [ ] Pennylane : intégrer quand clé API disponible
  - [ ] À l'upload du BC → Pennylane génère la facture automatiquement
  - [ ] Facture envoyée par email au client + visible dans `/mon-compte/factures`
  - [ ] Si `client_type === 'collectivite'` → dépôt automatique sur Chorus Pro (ou notif gérant si API ne le permet pas)
  - [ ] Si B2B/B2C → email + espace client uniquement
  - [ ] Pas de champ `chorus_pro` séparé — déduit du type de client
- [ ] BDC SAPAL : aligner le template jsPDF sur le style des documents Pennylane (cohérence visuelle)
- [ ] Mentions légales RGPD
- [ ] Mobile admin : sidebar non optimisée
