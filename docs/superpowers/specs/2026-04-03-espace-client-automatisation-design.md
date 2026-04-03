# SAPAL — Espace Client & Automatisation Commandes
## Spec technique — 3 avril 2026

---

## Contexte

SAPAL Signalisation dispose d'un site e-commerce B2B Next.js 16 (~85% terminé, non déployé) avec 1000+ produits. Tout le workflow post-devis est 100% manuel. Cette fonctionnalité crée un espace client dédié et automatise le workflow devis → commande fournisseur → facturation.

## Décisions d'architecture

| Décision | Choix | Justification |
|----------|-------|---------------|
| Routing client | `/mon-compte/` séparé de `/admin/` | Sécurité (isolation physique des routes), UX (URL pro pour clients) |
| Automatisation | Logique côté application (pas de webhooks) | Testable en local, transactionnel, pas de dépendance infra externe |
| Rôles | 3 : client, gérant, admin | Client = acheteur, Gérant = SAPAL, Admin = développeur |
| Pennylane | Implémenté, activable via env var | Code prêt, seule la clé API à renseigner |
| Validation comptes | Admin + Gérant + Telegram | Multi-canal pour flexibilité |

---

## 1. Schéma de données

### Nouvelles tables

#### `suppliers` (Migration 011)
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  postal_code VARCHAR(10),
  city TEXT,
  siret VARCHAR(14),
  contact_name TEXT,
  payment_terms TEXT NOT NULL DEFAULT '30j'
    CHECK (payment_terms IN ('30j', 'prepayment')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `orders` (Migration 016)
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id),
  user_id UUID NOT NULL,
  order_number TEXT NOT NULL UNIQUE,  -- format: CMD-YYYYMMDD-XXXX
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'partially_delivered', 'delivered', 'invoiced', 'cancelled')),
  total_ht NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  pennylane_invoice_id TEXT,
  invoice_url TEXT,
  delivered_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `order_items` (Migration 017)
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  variant_id UUID REFERENCES product_variants(id),
  variant_label TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES suppliers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `supplier_orders` (Migration 018)
```sql
CREATE TABLE supplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  bdc_number TEXT NOT NULL UNIQUE,  -- format: BDC-YYYYMMDD-XXXX
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'awaiting_payment', 'paid', 'sent', 'delivered', 'cancelled')),
  total_ht NUMERIC NOT NULL DEFAULT 0,
  bdc_pdf_url TEXT,
  payment_terms TEXT NOT NULL DEFAULT '30j',
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `supplier_order_items` (Migration 019)
```sql
CREATE TABLE supplier_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id UUID NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  variant_label TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Modifications de tables existantes

```sql
-- Migration 012: supplier_id sur products
ALTER TABLE products ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Migration 013: account_status sur client_profiles
ALTER TABLE client_profiles ADD COLUMN account_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (account_status IN ('pending', 'active', 'suspended'));

-- Migration 014: enrichir quote_items
ALTER TABLE quote_items ADD COLUMN unit_price NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quote_items ADD COLUMN variant_id UUID REFERENCES product_variants(id);
ALTER TABLE quote_items ADD COLUMN variant_label TEXT;

-- Migration 015: user_id sur quotes (lien auth pour clients connectés)
ALTER TABLE quotes ADD COLUMN user_id UUID;
```

### Séquences pour numérotation auto
```sql
-- Migration 020
CREATE SEQUENCE order_number_seq START WITH 1;
CREATE SEQUENCE bdc_number_seq START WITH 1;

CREATE FUNCTION generate_order_number() RETURNS TEXT AS $$
BEGIN
  RETURN 'CMD-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('order_number_seq')::text, 4, '0');
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION generate_bdc_number() RETURNS TEXT AS $$
BEGIN
  RETURN 'BDC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('bdc_number_seq')::text, 4, '0');
END; $$ LANGUAGE plpgsql;
```

---

## 2. RLS (Row Level Security) — Migration 021

| Table | Client | Gérant | Admin |
|-------|--------|--------|-------|
| `suppliers` | — | CRUD | CRUD |
| `orders` | SELECT own | ALL | ALL |
| `order_items` | SELECT own (via order.user_id) | ALL | ALL |
| `supplier_orders` | — | ALL | ALL |
| `supplier_order_items` | — | ALL | ALL |
| `quotes` | SELECT own (user_id ou email) | SELECT/UPDATE all | SELECT/UPDATE all |
| `quote_items` | SELECT own (via quote) | SELECT all | SELECT all |
| `client_profiles` | SELECT/UPDATE own | SELECT/UPDATE all | SELECT/UPDATE all |

---

## 3. Middleware

Fichier : `middleware.ts`

Modifications :
1. Ajouter `/mon-compte/*` au matcher
2. Pour `/mon-compte/*` : vérifier auth → vérifier role=client → vérifier account_status=active (sinon rediriger vers `/compte-en-attente`)
3. Ajouter les nouvelles API routes au matcher

```typescript
export const config = {
  matcher: [
    '/admin/:path*',
    '/mon-compte/:path*',
    '/api/quotes/:id/pdf',
    '/api/quotes/:id/chorus-pdf',
    '/api/orders/:path*',
    '/api/supplier-orders/:path*',
    '/api/invoices/:path*',
    '/api/clients/:path*',
  ],
}
```

---

## 4. Pages

### Nouvelles pages publiques
- `/inscription` — Formulaire d'inscription client (email, mot de passe, infos entreprise)
- `/connexion` — Login unifié (redirige vers /mon-compte ou /admin selon le rôle)
- `/compte-en-attente` — Page info pour comptes en attente de validation

### Espace client `/mon-compte/`
- `/mon-compte/` — Dashboard (stats devis, commandes, factures)
- `/mon-compte/devis` — Liste devis + boutons Accepter/Refuser pour les devis envoyés
- `/mon-compte/commandes` — Suivi des commandes avec statuts
- `/mon-compte/factures` — Liste des factures téléchargeables
- `/mon-compte/profil` — Édition infos entreprise (réutiliser la logique de `/admin/profil`)

Layout dédié : `src/app/mon-compte/layout.tsx` — sidebar + navigation client

### Extensions admin/gérant
- `/admin/clients` — Liste clients avec validation comptes en attente
- `/admin/commandes` — Vue globale de toutes les commandes
- `/admin/commandes/a-payer` — Dossier fournisseurs prépaiement
- `/admin/fournisseurs` — CRUD fournisseurs
- `/admin/fournisseurs/nouveau` — Créer fournisseur
- `/admin/fournisseurs/[id]` — Éditer fournisseur

Mise à jour du layout admin : supprimer `clientNavItems`, ajouter Clients/Commandes/Fournisseurs aux navs admin et gérant.

---

## 5. API Routes

| Route | Méthode | Auth | Action |
|-------|---------|------|--------|
| `/api/auth/register` | POST | public | Inscription client → crée user + profil (pending) + notif Telegram |
| `/api/clients/[id]/activate` | POST | admin/gérant | Active le compte → email bienvenue au client |
| `/api/quotes/[id]/accept` | POST | client (owner) | Accepte devis → crée order + supplier_orders + envoie BDC |
| `/api/quotes/[id]/reject` | POST | client (owner) | Refuse devis → statut rejected + notif SAPAL |
| `/api/supplier-orders/[id]/mark-paid` | POST | admin/gérant | Confirme prépaiement → envoie BDC au fournisseur |
| `/api/supplier-orders/[id]/mark-delivered` | POST | admin/gérant | Marque livré (par fournisseur) |
| `/api/orders/[id]/mark-delivered` | POST | admin/gérant | Marque commande livrée → crée facture Pennylane + email client |
| `/api/invoices/[id]/pdf` | GET | owner ou admin/gérant | Télécharge facture PDF |
| `/api/suppliers` | GET/POST | admin/gérant | Liste/crée fournisseurs |
| `/api/suppliers/[id]` | GET/PUT/DELETE | admin/gérant | CRUD fournisseur |

Toutes les routes POST utilisent validation Zod + rate limiting (pattern existant dans `/api/quotes/route.ts`).

---

## 6. Workflows métier

### Inscription client
```
Client s'inscrit sur /inscription
  → Supabase Auth crée le user (role: client)
  → Insert client_profiles (account_status: pending)
  → Notif Telegram à SAPAL avec lien vers /admin/clients
  → Client redirigé vers /compte-en-attente

Gérant/Admin clique "Valider" dans /admin/clients
  → POST /api/clients/{id}/activate
  → Update account_status = 'active'
  → Email de bienvenue au client (Resend)
  → Client peut maintenant accéder à /mon-compte/
```

### Devis → Commande
```
Client accepte un devis (status: sent) depuis /mon-compte/devis
  → POST /api/quotes/{id}/accept
  → Quote.status = 'accepted'
  → Créer order + order_items
  → Grouper par supplier_id
  → Pour chaque fournisseur :
      Si payment_terms = '30j' :
        → Générer BDC PDF
        → Envoyer par email au fournisseur (Resend)
        → supplier_order.status = 'sent'
      Si payment_terms = 'prepayment' :
        → Générer BDC PDF (en attente)
        → supplier_order.status = 'awaiting_payment'
        → Notif Telegram "BDC en attente de paiement"
  → Notif Telegram + email confirmation client
```

### Paiement fournisseur prépaiement
```
Gérant effectue le virement, puis dans /admin/commandes/a-payer :
  → POST /api/supplier-orders/{id}/mark-paid
  → supplier_order.status = 'paid' → 'sent'
  → BDC envoyé par email au fournisseur
  → Notif Telegram confirmation
```

### Livraison → Facturation
```
Chaque fournisseur livre → Gérant marque chaque supplier_order "livré"
  → POST /api/supplier-orders/{id}/mark-delivered

Quand TOUS les supplier_orders d'un order sont livrés :
  → Gérant marque l'order "livré"
  → POST /api/orders/{id}/mark-delivered
  → Crée facture via Pennylane API (createInvoice)
  → order.status = 'invoiced'
  → Email client avec facture en PJ
  → Facture visible dans /mon-compte/factures
```

---

## 7. Intégrations

### Pennylane (à compléter dans `src/lib/pennylane.ts`)
Ajouter :
- `createInvoice(data)` — crée une facture client
- `getInvoicePDF(id)` — récupère l'URL du PDF facture

Pattern identique aux fonctions existantes (`createEstimate`, `getEstimate`).

### Telegram (à extraire dans `src/lib/telegram.ts`)
Extraire le code inline de `src/app/api/quotes/route.ts` et `src/app/api/contact/route.ts` vers un utilitaire partagé :
- `sendTelegramMessage(text, replyMarkup?)` — message texte + boutons inline optionnels
- `sendTelegramDocument(buffer, filename, caption)` — envoi de fichier PDF

### PDF BDC (nouveau : `src/lib/pdf/generate-bdc-pdf.ts`)
Nouveau template pour les bons de commande fournisseur. Même style visuel que le devis PDF existant. Acheteur = SAPAL, Destinataire = fournisseur.

---

## 8. Types TypeScript

Ajouter dans `src/lib/supabase/types.ts` :
- `SupplierRow` — fournisseur
- `OrderRow` — commande client
- `OrderItemRow` — ligne de commande
- `SupplierOrderRow` — commande fournisseur
- `SupplierOrderItemRow` — ligne de commande fournisseur

Modifier :
- `ClientProfileRow` — ajouter `account_status`
- `QuoteRow` — ajouter `user_id`

---

## 9. Fichiers critiques à modifier

| Fichier | Modification |
|---------|-------------|
| `middleware.ts` | Ajouter /mon-compte/*, nouvelles API routes, vérification account_status |
| `src/lib/supabase/types.ts` | Nouvelles interfaces + modifications existantes |
| `src/lib/pennylane.ts` | Ajouter createInvoice, getInvoicePDF |
| `src/app/admin/layout.tsx` | Supprimer clientNavItems, ajouter Clients/Commandes/Fournisseurs |
| `src/store/useQuoteStore.ts` | Ajouter variant_id/unit_price au payload pour les clients connectés |

---

## 10. Séquence d'implémentation

| Phase | Contenu | Dépendances |
|-------|---------|-------------|
| 1 | Migrations DB + types + utilitaire Telegram + Pennylane | Aucune |
| 2 | Inscription + Connexion + Middleware | Phase 1 |
| 3 | Validation comptes (/admin/clients) | Phase 2 |
| 4 | Shell espace client (/mon-compte/ layout + dashboard + profil + devis) | Phase 2 |
| 5 | Accept/Reject devis (API routes) | Phase 4 |
| 6 | CRUD Fournisseurs (/admin/fournisseurs + API) | Phase 1 |
| 7 | Workflow commande complète (order creation, BDC PDF, envoi fournisseur) | Phase 5 + 6 |
| 8 | Admin commandes (/admin/commandes + a-payer + mark-paid/delivered) | Phase 7 |
| 9 | Espace client commandes + factures | Phase 8 |
| 10 | Facturation Pennylane + invoice PDF | Phase 9 |
| 11 | Nettoyage : stats dashboard, mise à jour nav, tests E2E | Phase 10 |

---

## 11. Vérification

- **DB** : Exécuter chaque migration via Supabase MCP, vérifier les tables avec `list_tables`
- **Auth** : Tester inscription → validation → login → accès /mon-compte/
- **Workflow** : Créer un devis test → accepter → vérifier order + supplier_orders créés
- **PDF** : Vérifier génération BDC PDF + envoi email fournisseur
- **Pennylane** : Tester createInvoice avec la clé API (ou vérifier le stub si pas de clé)
- **RLS** : Se connecter en tant que client, vérifier qu'on ne voit que ses propres données
- **Preview** : Utiliser preview tools pour vérifier chaque page visuellement
