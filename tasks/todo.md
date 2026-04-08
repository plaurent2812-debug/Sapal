# SAPAL — Todo

## Fait (28/03/2026)
- [x] Refonte design : typographie DM Serif Display + Outfit, animations Framer Motion, hero asymétrique, compteurs animés, footer premium
- [x] Header redesigné avec underline animé sur la nav
- [x] Fiches produit enrichies : sélecteur quantité, badges réassurance, produits similaires
- [x] Parcours devis : total HT, récap intégré, notification Telegram avec prix
- [x] Panel admin avec deux rôles (admin / client SAPAL)
- [x] CRUD produits, catégories, gestion devis
- [x] Création de devis depuis le panel client
- [x] Vercel Analytics installé
- [x] Fix turbopack.root (performances dev)

## Fait (28/03/2026 — suite)
- [x] Profils clients B2B/B2C/collectivite — table `client_profiles` avec RLS, page profil, page mes-devis, navigation client mise a jour
- [x] Migration Supabase appliquee (006_client_profiles.sql)
- [x] Optimisation images : logo compressé (717KB → 82KB), migration `<img>` → `next/image` (12 fichiers), remotePatterns pour Unsplash, lazy loading auto

## Fait (28/03/2026 — PDF)
- [x] Génération PDF de devis (jspdf) — utilitaire, route API, bouton télécharger dans admin/devis + admin/mes-devis

## Fait (28/03/2026 — Accessibilité)
- [x] Skip link "Aller au contenu principal" + id="main-content" sur <main>
- [x] aria-label sur nav header, nav footer (Catalogue + Entreprise)
- [x] aria-label sur boutons icônes (compte, recherche, effacer, panier, retirer, +/-)
- [x] role="search" + aria-label sur formulaire de recherche, type="search" sur input
- [x] Labels liés aux inputs (htmlFor/id) + aria-required sur champs obligatoires (contact + devis)
- [x] role="alert" sur messages d'erreur (contact + devis)
- [x] Focus ring amélioré (ring-2 + ring-offset-2) sur Button et Input
- [x] aria-labelledby sur sections homepage (catégories, produits phares, CTA)
- [x] aria-hidden sur SVG décoratif, badge compteur panier
- [x] CartButton : aria-label dynamique avec nombre d'articles

## Fait (28/03/2026 — Chorus Pro)
- [x] Génération PDF facture Chorus Pro (jspdf) — fournisseur/client avec SIRET/TVA, lignes HT, TVA 20%, TTC, mentions légales, conditions de paiement
- [x] Route API /api/quotes/[id]/chorus-pdf — récupère devis + profil client + prix produits, génère facture PDF
- [x] Bouton "Facture Chorus Pro" dans admin/devis — visible uniquement pour les devis acceptés
- [x] Info box Chorus Pro dans la page devis admin — explique le workflow de dépôt sur chorus-pro.gouv.fr

## Fait (28/03/2026 — PWA & Mobile)
- [x] PWA : manifest.json, icônes 192x192 et 512x512 (carrées avec padding), service worker avec cache-first/network-first
- [x] PWA : page offline (/offline) avec logo + message + bouton réessayer
- [x] PWA : composant ServiceWorkerRegister (client), intégré dans layout.tsx
- [x] PWA : metadata manifest + appleWebApp + viewport themeColor (Next.js 16 Viewport export)
- [x] Mobile : header restructuré — logo + panier + hamburger sur une ligne, barre de recherche en dessous
- [x] Mobile : drawer de navigation (MobileNav) avec liens, CTA devis, infos contact, fermeture Escape/overlay
- [x] Mobile : hero h1 réduit (text-4xl sur petit écran), boutons CTA pleine largeur sur mobile
- [x] Mobile : section chiffres clés en 3 colonnes même sur mobile (au lieu de 1)
- [x] Mobile : touch-action:manipulation sur boutons/liens, min 44px tap targets (pointer: coarse), -webkit-tap-highlight-color transparent

## Fait (31/03/2026 — Variantes produits)
- [x] Migration SQL `007_product_variants.sql` — table `product_variants` avec RLS
- [x] `types.ts` — ajout `ProductVariantRow`, `ProductVariant`, `variant_id`/`variant_label` dans `QuoteItemPayload`
- [x] `data.ts` — ajout `ClientVariant`, `toClientVariant`, `getVariantsByProduct`
- [x] `variant-selector.tsx` — composant client avec pills par axe (dimensions/finition/coloris), auto-sélection si un seul résultat
- [x] `product-page-client.tsx` — composant client gérant état `selectedVariant`, référence et prix dynamiques
- [x] `add-to-quote-section.tsx` — désactivation si variant requis non sélectionné, passage `variantId`/`variantLabel` à addItem
- [x] `useQuoteStore.ts` — `QuoteItem` avec `variantId`/`variantLabel`, `addItem` gère la déduplication par variant
- [x] `page.tsx` fiche produit — fetch variants en parallèle, colonne droite déléguée à `ProductPageClient`
- [x] `npm run build` — 0 erreur TypeScript

## Fait (03/04/2026 — Espace Client & Automatisation Commandes)

### Phase 1 : Fondations DB
- [x] Nouvelles tables : `suppliers`, `orders`, `order_items`, `supplier_orders`, `supplier_order_items`
- [x] Modifications : `products.supplier_id`, `client_profiles.account_status`, `quote_items.unit_price/variant_id`, `quotes.user_id`
- [x] Séquences : `generate_order_number()`, `generate_bdc_number()`
- [x] RLS complètes sur toutes les nouvelles tables
- [x] Types TypeScript : SupplierRow, OrderRow, OrderItemRow, SupplierOrderRow, SupplierOrderItemRow
- [x] Utilitaire Telegram partagé (`src/lib/telegram.ts`) — extraction du code inline des routes existantes
- [x] Pennylane : ajout `createInvoice()` et `getInvoicePDF()`

### Phase 2 : Auth & Inscription
- [x] Page `/inscription` — formulaire client complet (email, mdp, entreprise, SIRET, TVA, type)
- [x] Page `/connexion` — login unifié avec redirection par rôle
- [x] Page `/compte-en-attente` — info post-inscription
- [x] API `POST /api/auth/register` — inscription + profil pending + notif Telegram
- [x] Middleware étendu : `/mon-compte/*` protégé avec vérification account_status

### Phase 3 : Validation comptes
- [x] Page `/admin/clients` — liste clients avec onglets (en attente/actifs/tous) + bouton valider
- [x] API `GET /api/clients` — liste avec emails
- [x] API `POST /api/clients/[id]/activate` — activation + email bienvenue Resend + notif Telegram

### Phase 4 : Espace client
- [x] Layout `/mon-compte/` — sidebar dédiée client (dashboard, devis, commandes, factures, profil)
- [x] Dashboard client — stats devis/commandes/factures + actions rapides
- [x] Page devis client — liste + boutons Accepter/Refuser
- [x] Page profil client — édition infos entreprise
- [x] Pages placeholder commandes + factures

### Phase 5 : Accept/Reject devis
- [x] API `POST /api/quotes/[id]/accept` — workflow complet : accepte devis → crée order → crée supplier_orders groupés par fournisseur
- [x] API `POST /api/quotes/[id]/reject` — refuse devis + notif Telegram

### Phase 6 : Fournisseurs
- [x] CRUD API `/api/suppliers` — liste, création, édition, suppression (protégée si produits liés)
- [x] Pages admin : `/admin/fournisseurs`, `/nouveau`, `/[id]`
- [x] Validation Zod complète (SIRET, payment_terms enum)

### Phase 7 : BDC PDF + envoi fournisseur
- [x] Générateur BDC PDF (`src/lib/pdf/generate-bdc-pdf.ts`) — même style que devis/chorus
- [x] Intégration dans route accept : BDC auto-envoyé aux fournisseurs 30j, mis en attente pour prépaiement
- [x] Envoi email fournisseur via Resend avec BDC en PJ
- [x] Envoi BDC via Telegram à SAPAL

### Phase 8 : Admin commandes
- [x] Page `/admin/commandes` — vue globale avec onglets + lignes expansibles (items + supplier_orders)
- [x] Page `/admin/commandes/a-payer` — BDC en attente de paiement avec bouton "Payé"
- [x] API `POST /api/supplier-orders/[id]/mark-paid` — confirme paiement + envoie BDC
- [x] API `POST /api/supplier-orders/[id]/mark-delivered` — marque livraison fournisseur
- [x] API `POST /api/orders/[id]/mark-delivered` — livraison complète + facturation Pennylane

### Phase 9 : Client commandes + factures
- [x] Page `/mon-compte/commandes` — commandes client avec statuts + détails expansibles
- [x] Page `/mon-compte/factures` — factures téléchargeables (Pennylane ou PDF local)
- [x] API `GET /api/invoices/[id]/pdf` — génération facture PDF à la demande

### Phase 10 : Pennylane
- [x] Intégration complète dans mark-delivered : get/create customer → create invoice → get PDF URL
- [x] Fallback local si Pennylane non configuré

### Phase 11 : Nettoyage
- [x] Dashboard admin étendu : stats clients actifs/en attente + commandes en cours + quick links
- [x] Header : lien dynamique Se connecter / Mon compte / Administration
- [x] Quotes : user_id automatique pour les clients connectés
- [x] Navigation admin : ajout Clients, Commandes, Fournisseurs

---

## Fait (03/04/2026 — Création devis admin enrichie)
- [x] Page `/admin/devis/nouveau` — toggle "Client existant / Saisie manuelle" avec dropdown des clients fetchés depuis `/api/clients`
- [x] Auto-remplissage entity/email/phone depuis le profil client sélectionné + stockage `user_id`
- [x] Sélecteur "Canal d'origine" (admin/site/telephone) — sauvegardé dans `quotes.source`
- [x] Checkbox "Envoyer directement au client" — passe le statut à `sent` via `/api/quotes/[id]/send`
- [x] `unit_price` sauvegardé sur `quote_items` dès la création admin
- [x] API `POST /api/quotes/[id]/send` — génère PDF, envoie email Resend avec pièce jointe, met à jour statut `sent`, notif Telegram

## Fait (07/04/2026 — Flux commandes v2)
- [x] Pré-remplissage formulaire devis depuis le profil client connecté
- [x] Migration 011 : tables orders, order_items, supplier_orders, supplier_order_items, suppliers + RPC + storage bucket
- [x] Refactoring accept quote : crée commande en `awaiting_bc` → client uploade BC → commandes fournisseur créées
- [x] Endpoint `POST /api/orders/[id]/upload-bc` : upload BC + adresse livraison → crée supplier orders + envoie BDC
- [x] BDC PDF : ajout bloc adresse de livraison
- [x] UI client commandes : formulaire upload BC avec adresse pré-remplie
- [x] UI admin commandes : statut awaiting_bc, affichage BC et adresse livraison
- [x] Envoi automatique du devis au client dès la création (statut `sent` direct)
- [x] Email notification au gérant quand un devis est créé (récap + PDF en PJ)
- [x] Bouton "Envoyer le devis" dans admin (remplace le dropdown statut)

---

## 🔴 PRIORITÉ : Tester le flux complet (reprendre ici)

### Pré-requis
- [ ] Vérifier domaine `sapal-signaletique.fr` vérifié dans Resend (sinon emails ne partent pas)
- [ ] Ajouter variables d'env dans **Vercel** si test en prod : `RESEND_FROM_EMAIL`, `RESEND_FROM_QUOTES_EMAIL`, `SAPAL_GERANT_EMAIL`
- [ ] Vérifier qu'au moins 1 produit Procity a un `supplier_id` assigné

### Test 1 — Création devis (client)
- [ ] Se connecter en tant que client test
- [ ] Ajouter un produit Procity au devis, soumettre
- [ ] ✉️ Email reçu par le **client** avec PDF devis en PJ ?
- [ ] ✉️ Email reçu par le **gérant** (p.laurent@opti-pro.fr) avec récap + PDF ?
- [ ] 📱 Telegram reçu ?
- [ ] Devis visible en statut **"Envoyé"** dans l'espace client ET dans l'admin ?

### Test 2 — Acceptation devis (client)
- [ ] Depuis l'espace client > Mes Devis, accepter le devis
- [ ] Commande créée en statut **"En attente de votre BC"** dans Mes Commandes ?
- [ ] ✉️ Email client demandant d'uploader son BC ?
- [ ] 📱 Telegram "Devis accepté — Commande en attente de BC" ?

### Test 3 — Upload BC + adresse livraison (client)
- [ ] Depuis Mes Commandes, sur la commande "En attente de votre BC"
- [ ] Uploader un PDF bidon comme BC
- [ ] Adresse de livraison pré-remplie depuis le profil ?
- [ ] Valider → statut passe à **"En cours"** ?
- [ ] ✉️ Email BDC reçu sur le mail test Procity (avec PDF BDC en PJ) ?
- [ ] Le PDF BDC contient l'adresse de livraison ?
- [ ] 📱 Telegram "BC client reçu — Commandes fournisseur créées" ?

### Test 4 — Vue admin
- [ ] Commande visible dans Admin > Commandes avec bon statut ?
- [ ] Lien téléchargement BC client visible ?
- [ ] Adresse de livraison affichée ?

---

## À faire (après validation flux)
- [ ] **Telegram 4 channels** — Devis, Paiements, Commandes, Contact (1 bot, 4 groupes)
- [ ] **Tester flux pré-paiement** — fournisseur avec `payment_terms = 'prepayment'`
- [ ] **`purchase_price` sur produits** — renseigner les prix d'achat fournisseur
- [ ] **Configurer vrais emails fournisseurs** — remplacer emails test
- [ ] **Pennylane** — intégrer quand clé API disponible
- [ ] **Déployer sur Vercel** — configurer variables d'env production
- [ ] **Images produits** — beaucoup de produits sans image
- [ ] **Mobile admin** — sidebar non optimisée mobile
- [ ] **Mentions légales** — page complète (RGPD, cookies)
- [ ] **Changer mots de passe** — remplacer Sapal2026! en production
