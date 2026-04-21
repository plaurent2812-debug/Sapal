# Intégration Pennylane — Devis & Factures

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer les devis et factures dans Pennylane au lieu de les générer localement en jsPDF. Les BC fournisseurs restent internes.

**Architecture:** Quand Pennylane est configuré (`PENNYLANE_API_KEY`), les devis sont créés comme estimates dans Pennylane et les factures sont créées à la livraison. Les PDF viennent de Pennylane. Sans clé API, tout continue en jsPDF (fallback dev local). Le flux est : client/gérant crée un devis → estimate Pennylane → client accepte → commande → livraison → invoice Pennylane (mêmes données que l'estimate).

**Tech Stack:** Pennylane API v1 (`/customer_estimates`, `/customer_invoices`), Supabase, Next.js API routes, Resend

---

## File Structure

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `supabase/migrations/014_pennylane_integration.sql` | Create | Migration : ajoute `pennylane_estimate_id` et `pennylane_pdf_url` sur `quotes` |
| `src/lib/supabase/types.ts` | Modify | Ajoute les 2 champs sur `QuoteRow` |
| `src/lib/pennylane.ts` | Modify | Ajoute `getEstimatePDF()`, met à jour `createEstimate()` |
| `src/lib/pennylane-helpers.ts` | Create | Fonction partagée `createPennylaneEstimateForQuote()` |
| `src/app/api/quotes/route.ts` | Modify | Appel Pennylane après insertion Supabase |
| `src/app/api/quotes/[id]/send/route.ts` | Modify | Utilise PDF Pennylane si dispo, crée estimate si manquant |
| `src/app/admin/devis/nouveau/page.tsx` | Modify | Appel API pour créer estimate Pennylane après insertion |
| `src/app/api/quotes/[id]/pdf/route.ts` | Modify | Redirect vers PDF Pennylane si dispo |
| `src/app/api/orders/[id]/mark-delivered/route.ts` | Modify | Récupère `pennylane_estimate_id` pour lier facture à devis |

---

### Task 1: Migration SQL — Colonnes Pennylane sur quotes

**Files:**
- Create: `supabase/migrations/014_pennylane_integration.sql`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Créer la migration SQL**

```sql
-- 014_pennylane_integration.sql
-- Ajout des champs Pennylane pour les devis

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS pennylane_estimate_id TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS pennylane_pdf_url TEXT;

-- Index pour recherche rapide par ID Pennylane
CREATE INDEX IF NOT EXISTS idx_quotes_pennylane_estimate_id ON quotes(pennylane_estimate_id) WHERE pennylane_estimate_id IS NOT NULL;
```

- [ ] **Step 2: Exécuter la migration sur Supabase**

Via le dashboard Supabase ou le MCP `apply_migration`.

- [ ] **Step 3: Mettre à jour les types TypeScript**

Dans `src/lib/supabase/types.ts`, le type `QuoteRow` a déjà `pennylane_quote_id` (ligne 73). Le renommer en `pennylane_estimate_id` et ajouter `pennylane_pdf_url` :

```typescript
export interface QuoteRow {
  id: string
  entity: string
  contact_name: string
  email: string
  phone: string
  message: string | null
  items: QuoteItemPayload[]
  status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'cancelled'
  source: 'site' | 'admin' | 'telephone'
  user_id: string | null
  pennylane_estimate_id: string | null
  pennylane_pdf_url: string | null
  created_at: string
}
```

- [ ] **Step 4: Vérifier que le rename ne casse rien**

Rechercher `pennylane_quote_id` dans tout le code et remplacer par `pennylane_estimate_id` :
- `src/app/api/quotes/[id]/delete/route.ts` — utilise `pennylane_quote_id` pour décider cancel vs delete

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/014_pennylane_integration.sql src/lib/supabase/types.ts src/app/api/quotes/[id]/delete/route.ts
git commit -m "feat: migration Pennylane — colonnes estimate sur quotes"
```

---

### Task 2: Enrichir le client Pennylane

**Files:**
- Modify: `src/lib/pennylane.ts`

- [ ] **Step 1: Ajouter `getEstimatePDF()`**

Après la fonction `getEstimate()` dans `src/lib/pennylane.ts` :

```typescript
export async function getEstimatePDF(estimateId: string): Promise<string | null> {
  const res = await fetch(`${PENNYLANE_API_URL}/customer_estimates/${estimateId}`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`Pennylane getEstimatePDF failed: ${res.status}`)
  const data = await res.json()
  return data.customer_estimate?.file_url ?? null
}
```

- [ ] **Step 2: Mettre à jour `createEstimate()` pour accepter le customer complet**

Remplacer la signature de `createEstimate()` pour matcher le schéma Pennylane v1 complet :

```typescript
export async function createEstimate(data: {
  date: string
  deadline?: string
  currency?: string
  language?: string
  customer: {
    source_id?: string
    name?: string
    emails?: string[]
    phone?: string
    address?: string
    postal_code?: string
    city?: string
    reg_no?: string
    country_alpha2?: string
  }
  items: {
    label: string
    quantity: number
    unitPrice: number
    vatRate: number
    description?: string
  }[]
}) {
  const res = await fetch(`${PENNYLANE_API_URL}/customer_estimates`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      create_customer: !data.customer.source_id,
      create_products: false,
      estimate: {
        date: data.date,
        deadline: data.deadline,
        currency: data.currency || 'EUR',
        language: data.language || 'fr_FR',
        customer: {
          ...(data.customer.source_id ? { source_id: data.customer.source_id } : {}),
          name: data.customer.name,
          emails: data.customer.emails,
          phone: data.customer.phone,
          address: data.customer.address,
          postal_code: data.customer.postal_code,
          city: data.customer.city,
          reg_no: data.customer.reg_no,
          country_alpha2: data.customer.country_alpha2 || 'FR',
        },
        line_items: data.items.map(item => ({
          label: item.label,
          quantity: item.quantity,
          unit: 'piece',
          vat_rate: String(item.vatRate),
          currency_amount: item.unitPrice,
          description: item.description || '',
        })),
      },
    }),
  })
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    throw new Error(`Pennylane createEstimate failed: ${res.status} — ${errorBody}`)
  }
  return res.json()
}
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/pennylane.ts
git commit -m "feat: enrichir client Pennylane — getEstimatePDF + createEstimate v1 complet"
```

---

### Task 3: Fonction partagée `createPennylaneEstimateForQuote()`

**Files:**
- Create: `src/lib/pennylane-helpers.ts`

- [ ] **Step 1: Créer le helper**

Ce helper est appelé par les routes de soumission client ET création admin. Il gère : get/create customer Pennylane → create estimate → stocker IDs sur le quote.

```typescript
import {
  isPennylaneConfigured,
  createEstimate,
  getEstimatePDF,
  getCustomerByEmail,
  createCustomer,
} from '@/lib/pennylane'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Crée un estimate Pennylane pour un devis existant en base.
 * Stocke pennylane_estimate_id et pennylane_pdf_url sur le quote.
 * No-op si Pennylane non configuré ou si estimate déjà créé.
 * Ne throw jamais — log les erreurs et retourne null.
 */
export async function createPennylaneEstimateForQuote(quoteId: string): Promise<{
  estimateId: string
  pdfUrl: string | null
} | null> {
  if (!isPennylaneConfigured()) return null

  const supabase = createServiceRoleClient()

  try {
    // 1. Fetch quote + items
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('id', quoteId)
      .single()

    if (quoteError || !quote) {
      console.error('Pennylane helper: quote not found', quoteError)
      return null
    }

    // Skip if already created
    if (quote.pennylane_estimate_id) {
      return {
        estimateId: quote.pennylane_estimate_id,
        pdfUrl: quote.pennylane_pdf_url,
      }
    }

    // 2. Get or create customer in Pennylane
    let pennylaneCustomer = await getCustomerByEmail(quote.email).catch(() => null)

    if (!pennylaneCustomer) {
      // Fetch profile data if user_id is set
      let profileData: {
        company_name?: string | null
        phone?: string | null
        address?: string | null
        postal_code?: string | null
        city?: string | null
        siret?: string | null
      } = {}

      if (quote.user_id) {
        const { data: profile } = await supabase
          .from('client_profiles')
          .select('company_name, phone, address, postal_code, city, siret')
          .eq('user_id', quote.user_id)
          .single()
        if (profile) profileData = profile
      }

      pennylaneCustomer = await createCustomer({
        name: quote.entity || profileData.company_name || quote.email,
        email: quote.email,
        phone: quote.phone || profileData.phone || undefined,
        address: profileData.address || undefined,
        postalCode: profileData.postal_code || undefined,
        city: profileData.city || undefined,
        siret: profileData.siret || undefined,
      })
    }

    const customerSourceId = pennylaneCustomer?.source_id ?? pennylaneCustomer?.id
    if (!customerSourceId) {
      console.error('Pennylane helper: could not get customer source_id')
      return null
    }

    // 3. Fetch product references for line item labels
    const items = quote.quote_items as {
      product_id: string
      product_name: string
      quantity: number
      unit_price: number
      delai?: string | null
    }[]

    const productIds = items.map(i => i.product_id)
    const { data: products } = await supabase
      .from('products')
      .select('id, reference')
      .in('id', productIds)
    const refMap = new Map((products ?? []).map((p: { id: string; reference: string }) => [p.id, p.reference || '']))

    // 4. Create estimate
    const today = new Date().toISOString().split('T')[0]
    const deadline = new Date()
    deadline.setDate(deadline.getDate() + 30)

    const estimateData = await createEstimate({
      date: today,
      deadline: deadline.toISOString().split('T')[0],
      customer: { source_id: customerSourceId },
      items: items.map(item => {
        const ref = refMap.get(item.product_id)
        const label = ref ? `[${ref}] ${item.product_name}` : item.product_name
        return {
          label,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          vatRate: 0.2,
          description: item.delai ? `Délai: ${item.delai}` : undefined,
        }
      }),
    })

    const estimateId = estimateData?.customer_estimate?.id ?? estimateData?.id
    if (!estimateId) {
      console.error('Pennylane helper: no estimate ID returned')
      return null
    }

    // 5. Get PDF URL
    const pdfUrl = await getEstimatePDF(estimateId).catch(() => null)

    // 6. Store on quote
    await supabase
      .from('quotes')
      .update({
        pennylane_estimate_id: estimateId,
        pennylane_pdf_url: pdfUrl,
      })
      .eq('id', quoteId)

    return { estimateId, pdfUrl }
  } catch (err) {
    console.error('Pennylane helper: failed to create estimate', err)
    return null
  }
}
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/pennylane-helpers.ts
git commit -m "feat: helper partagé createPennylaneEstimateForQuote"
```

---

### Task 4: Soumission devis client → Pennylane

**Files:**
- Modify: `src/app/api/quotes/route.ts`

- [ ] **Step 1: Ajouter l'appel Pennylane après l'insertion Supabase**

Dans `sendNotifications()`, **avant** l'envoi email au client, créer l'estimate Pennylane et utiliser le PDF Pennylane si dispo.

En haut du fichier, ajouter l'import :
```typescript
import { createPennylaneEstimateForQuote } from '@/lib/pennylane-helpers'
```

Dans la fonction `POST`, **après** la génération du PDF jsPDF et **avant** `sendNotifications()` :

```typescript
    // Créer l'estimate dans Pennylane (non-bloquant si échoue)
    const pennylaneResult = await createPennylaneEstimateForQuote(quoteId).catch(() => null)

    // Notifications (await pour garantir l'envoi sur Vercel serverless)
    await sendNotifications({
      entity, contactName, email, phone, items, quoteId, pdfBuffer,
      pennylanePdfUrl: pennylaneResult?.pdfUrl ?? null,
    }).catch(e => {
      console.error('Failed to send notifications:', e)
    })
```

Mettre à jour la signature de `sendNotifications` pour accepter `pennylanePdfUrl`:
```typescript
async function sendNotifications(params: {
  // ... existing fields ...
  pennylanePdfUrl: string | null
}) {
```

Dans l'email au client, si `pennylanePdfUrl` est disponible, ajouter un lien "Voir le devis" en plus de la pièce jointe jsPDF. Le PDF jsPDF reste en pièce jointe comme fallback (au cas où le lien Pennylane expire).

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/quotes/route.ts
git commit -m "feat: soumission devis client → crée estimate Pennylane"
```

---

### Task 5: Envoi devis par le gérant → Pennylane

**Files:**
- Modify: `src/app/api/quotes/[id]/send/route.ts`

- [ ] **Step 1: Créer l'estimate Pennylane si pas encore fait**

Au début de la route, après le fetch du quote, vérifier si `pennylane_estimate_id` existe. Sinon, le créer.

Ajouter l'import :
```typescript
import { createPennylaneEstimateForQuote } from '@/lib/pennylane-helpers'
```

Après le fetch du quote et avant la génération du PDF :
```typescript
    // Créer l'estimate Pennylane si pas encore fait
    if (!quote.pennylane_estimate_id) {
      await createPennylaneEstimateForQuote(id).catch(() => null)
      // Re-fetch pour avoir le pennylane_pdf_url
      const { data: updatedQuote } = await supabase
        .from('quotes')
        .select('pennylane_pdf_url')
        .eq('id', id)
        .single()
      if (updatedQuote?.pennylane_pdf_url) {
        quote.pennylane_pdf_url = updatedQuote.pennylane_pdf_url
      }
    }
```

Dans l'email au client, ajouter le lien PDF Pennylane si dispo (en plus de la pièce jointe jsPDF).

- [ ] **Step 2: Ajouter `pennylane_estimate_id, pennylane_pdf_url` au select du quote**

Le select actuel est `'*, quote_items(*)'`. Il inclut déjà tous les champs, donc rien à changer.

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/quotes/[id]/send/route.ts"
git commit -m "feat: envoi devis gérant → crée estimate Pennylane si manquant"
```

---

### Task 6: Création devis admin → Pennylane

**Files:**
- Modify: `src/app/admin/devis/nouveau/page.tsx`

- [ ] **Step 1: Appeler la création Pennylane après l'insertion**

Dans `handleSubmit()`, après l'insertion dans Supabase et avant le `sendDirectly` check, ajouter un appel à une route API :

```typescript
    // Créer l'estimate Pennylane (non-bloquant)
    await fetch(`/api/quotes/${quoteId}/pennylane-estimate`, {
      method: 'POST',
    }).catch(() => {})
```

- [ ] **Step 2: Créer la route API dédiée**

Create: `src/app/api/quotes/[id]/pennylane-estimate/route.ts`

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createPennylaneEstimateForQuote } from '@/lib/pennylane-helpers'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Auth check: admin or gerant only
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const role = (user.user_metadata?.role as string) ?? 'client'
    if (role !== 'admin' && role !== 'gerant') {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const result = await createPennylaneEstimateForQuote(id)

    if (!result) {
      return Response.json({ error: 'Pennylane non configuré ou erreur' }, { status: 422 })
    }

    return Response.json({
      success: true,
      estimateId: result.estimateId,
      pdfUrl: result.pdfUrl,
    })
  } catch (error) {
    console.error('API Error [pennylane-estimate]:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/quotes/[id]/pennylane-estimate/route.ts" src/app/admin/devis/nouveau/page.tsx
git commit -m "feat: création devis admin → appel Pennylane estimate"
```

---

### Task 7: Route PDF — Redirect vers Pennylane si dispo

**Files:**
- Modify: `src/app/api/quotes/[id]/pdf/route.ts`

- [ ] **Step 1: Ajouter le redirect Pennylane**

Au début de la route, après le fetch du quote, vérifier si `pennylane_pdf_url` existe :

```typescript
    // Si PDF Pennylane disponible, redirect
    if (quote.pennylane_pdf_url) {
      return Response.redirect(quote.pennylane_pdf_url, 302)
    }

    // Sinon, génération jsPDF (fallback)
    // ... existing code ...
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/quotes/[id]/pdf/route.ts"
git commit -m "feat: route PDF devis → redirect Pennylane si dispo"
```

---

### Task 8: Factures — Lier à l'estimate Pennylane

**Files:**
- Modify: `src/app/api/orders/[id]/mark-delivered/route.ts`

- [ ] **Step 1: Récupérer le `pennylane_estimate_id` depuis le devis d'origine**

Le flow actuel crée une facture from scratch. On doit maintenant ajouter une référence au devis d'origine pour la traçabilité comptable.

Après le fetch de l'order et avant la section Pennylane (ligne ~92), ajouter :

```typescript
    // Récupérer le devis d'origine pour la référence Pennylane
    const { data: originQuote } = await serviceClient
      .from('quotes')
      .select('pennylane_estimate_id, entity')
      .eq('id', order.quote_id)
      .single()
```

Dans l'appel à `createInvoice()`, ajouter une mention du devis dans le `pdf_invoice_subject` si disponible. Modifier l'appel existant pour inclure cette info dans les items (ajouter une ligne de référence) :

Le code existant utilise déjà `createInvoice` avec les `orderItems`. Ajouter `pdf_invoice_free_text` au body pour référencer le devis. Cela nécessite de modifier `createInvoice()` dans `pennylane.ts` pour accepter des champs optionnels.

- [ ] **Step 2: Ajouter `pdfInvoiceSubject` à `createInvoice()`**

Dans `src/lib/pennylane.ts`, mettre à jour la signature de `createInvoice` :

```typescript
export async function createInvoice(data: {
  customerSourceId: string
  date: string
  deadline: string
  pdfInvoiceSubject?: string
  items: {
    label: string
    quantity: number
    unitPrice: number
    vatRate: number
  }[]
}) {
  // ... dans le body JSON :
  // pdf_invoice_subject: data.pdfInvoiceSubject || undefined,
```

Dans `mark-delivered/route.ts`, passer le sujet :

```typescript
    const invoiceData = await createInvoice({
      customerSourceId: pennylaneCustomer.source_id ?? pennylaneCustomer.id,
      date: today.toISOString().split('T')[0],
      deadline: deadlineDate.toISOString().split('T')[0],
      pdfInvoiceSubject: originQuote?.pennylane_estimate_id
        ? `Facture relative au devis Pennylane ${originQuote.pennylane_estimate_id}`
        : undefined,
      items: orderItems.map(/* ... existing mapping ... */),
    })
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/pennylane.ts "src/app/api/orders/[id]/mark-delivered/route.ts"
git commit -m "feat: facture Pennylane référence le devis d'origine"
```

---

### Task 9: Nettoyage et vérification finale

**Files:**
- Modify: `src/app/api/quotes/[id]/delete/route.ts` (si encore ref à `pennylane_quote_id`)

- [ ] **Step 1: Vérifier les références obsolètes**

Run: `grep -r "pennylane_quote_id" src/`
Si des résultats, remplacer par `pennylane_estimate_id`.

- [ ] **Step 2: TypeScript check complet**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "chore: nettoyage refs pennylane_quote_id → pennylane_estimate_id"
```

- [ ] **Step 4: Push et PR**

```bash
git push -u origin feat/pennylane-integration
gh pr create --title "feat: intégration Pennylane — devis & factures" --body "..."
```

---

## Notes

- **Sans `PENNYLANE_API_KEY`** : tout fonctionne comme avant (jsPDF). Le code est 100% rétro-compatible.
- **BC fournisseurs** : inchangés, restent en jsPDF interne avec prix d'achat.
- **L'API Pennylane v1 n'a pas d'endpoint "convert estimate to invoice"**. La facture est créée séparément avec les mêmes données. Le `pdf_invoice_subject` fait le lien comptable.
- **Le PDF Pennylane** est hébergé chez Pennylane (URL signée). Le fallback jsPDF reste pour le dev local.
