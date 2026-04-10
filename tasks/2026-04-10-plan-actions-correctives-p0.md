# SAPAL — Plan d'Implementation Actions Correctives P0

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Etablir un filet de securite pour SAPAL en mettant en place tests automatises, CI/CD, rate limiting persistant (Upstash Redis), et remplacer les images placeholder du catalogue.

**Architecture:** Projet Next.js 16 / React 19 / Supabase existant. On ajoute une couche de tests Vitest + @testing-library, on remplace le rate limiter in-memory par @upstash/ratelimit (serverless-safe), on met en place GitHub Actions pour la CI, et on migre les images produit vers Supabase Storage en WebP.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Vitest, @testing-library/react, @upstash/ratelimit, Supabase, jsPDF, Zustand, Tailwind CSS 4, GitHub Actions.

**Scope:** Ce plan couvre uniquement les actions P0 du doc `04_SAPAL_actions_correctives.md` (Actions 1, 2, 3). Les actions P1 (Pennylane) et P2 (PWA) feront l'objet de plans separes une fois ce plan execute.

**Project root:** `/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet/`

---

## PHASE 1 — Fondation tests & CI/CD

### Task 1: Installer Vitest et dependances de test

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1.1: Installer les dependances de dev**

Run:
```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet" && \
npm install --save-dev vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```

Expected: `added N packages` sans erreur.

- [ ] **Step 1.2: Ajouter les scripts npm**

Edit `package.json`, section `"scripts"`, remplacer par :
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

- [ ] **Step 1.3: Creer `vitest.config.ts` a la racine**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/lib/**',
        'src/app/api/**',
        'src/store/**',
        'middleware.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        '**/.next/**',
      ],
      thresholds: {
        statements: 40,
        branches: 30,
        functions: 40,
        lines: 40,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 1.4: Creer `vitest.setup.ts` a la racine**

```typescript
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// Mock des variables d'env publiques utilisees par Supabase
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
vi.stubEnv('RESEND_API_KEY', 'test-resend-key')
vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@test.sapal.fr')
vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-telegram-token')
vi.stubEnv('TELEGRAM_CHAT_ID', 'test-chat-id')
vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-upstash-token')
```

- [ ] **Step 1.5: Verifier que Vitest demarre**

Run: `npm run test`
Expected: `No test files found, exiting with code 0` (ou code 1 selon la version — pas d'erreur de config)

- [ ] **Step 1.6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "chore: setup Vitest + testing-library infrastructure"
```

---

### Task 2: Tester la logique de store Zustand (panier devis)

**Files:**
- Create: `src/store/useQuoteStore.test.ts`

- [ ] **Step 2.1: Ecrire le fichier de test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useQuoteStore } from './useQuoteStore'
import type { ClientProduct } from '@/lib/data'

const mockProduct: ClientProduct = {
  id: 'prod-1',
  nom: 'Panneau Stop',
  slug: 'panneau-stop',
  categorie: 'signalisation',
  prix: 120,
  description: 'Panneau de signalisation',
  image_url: 'https://example.com/stop.webp',
} as ClientProduct

describe('useQuoteStore', () => {
  beforeEach(() => {
    useQuoteStore.getState().clearCart()
  })

  it('starts with an empty cart', () => {
    expect(useQuoteStore.getState().items).toEqual([])
  })

  it('adds a new item to the cart', () => {
    useQuoteStore.getState().addItem(mockProduct, 2)
    const items = useQuoteStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].product.id).toBe('prod-1')
    expect(items[0].quantity).toBe(2)
  })

  it('merges quantities when adding the same product+variant twice', () => {
    useQuoteStore.getState().addItem(mockProduct, 2)
    useQuoteStore.getState().addItem(mockProduct, 3)
    const items = useQuoteStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(5)
  })

  it('keeps separate entries for different variants', () => {
    useQuoteStore.getState().addItem(mockProduct, 1, 'var-a', 'Variant A', '5j', 150)
    useQuoteStore.getState().addItem(mockProduct, 1, 'var-b', 'Variant B', '10j', 180)
    expect(useQuoteStore.getState().items).toHaveLength(2)
  })

  it('updates quantity for an existing item', () => {
    useQuoteStore.getState().addItem(mockProduct, 1)
    useQuoteStore.getState().updateQuantity('prod-1', 7)
    expect(useQuoteStore.getState().items[0].quantity).toBe(7)
  })

  it('removes an item by productId', () => {
    useQuoteStore.getState().addItem(mockProduct, 1)
    useQuoteStore.getState().removeItem('prod-1')
    expect(useQuoteStore.getState().items).toHaveLength(0)
  })

  it('clears the cart', () => {
    useQuoteStore.getState().addItem(mockProduct, 5)
    useQuoteStore.getState().clearCart()
    expect(useQuoteStore.getState().items).toEqual([])
  })
})
```

- [ ] **Step 2.2: Lancer les tests (certains peuvent echouer si l'API du store differe)**

Run: `npm run test -- src/store/useQuoteStore.test.ts`
Expected: Les tests revelent la vraie signature du store. Si certains echouent par signature, ajuster les tests pour matcher le code existant — ne PAS modifier le store en premier.

- [ ] **Step 2.3: Si un test echoue par signature reelle differente, ajuster UNIQUEMENT le test**

Lire `src/store/useQuoteStore.ts` pour la signature exacte, puis corriger les appels dans le test. Le but est de documenter le comportement existant, pas de changer le code.

- [ ] **Step 2.4: Verifier que tous les tests passent**

Run: `npm run test -- src/store/useQuoteStore.test.ts`
Expected: `7 passed`

- [ ] **Step 2.5: Commit**

```bash
git add src/store/useQuoteStore.test.ts
git commit -m "test: add unit tests for useQuoteStore (cart logic)"
```

---

### Task 3: Tester l'utilitaire rate-limit existant (avant migration)

**Files:**
- Create: `src/lib/rate-limit.test.ts`

- [ ] **Step 3.1: Ecrire le fichier de test documentant le comportement actuel**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit } from './rate-limit'

describe('checkRateLimit (in-memory legacy)', () => {
  beforeEach(() => {
    // Reset du Map interne n'est pas expose. On utilise des IPs uniques par test.
  })

  it('allows first request from a new IP', () => {
    const result = checkRateLimit('10.0.0.1', 10, 60000)
    expect(result).toBe(true)
  })

  it('blocks after exceeding max requests within the window', () => {
    const ip = '10.0.0.2'
    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip, 5, 60000)
    }
    const blocked = checkRateLimit(ip, 5, 60000)
    expect(blocked).toBe(false)
  })

  it('resets counter after the time window expires', async () => {
    const ip = '10.0.0.3'
    checkRateLimit(ip, 1, 50) // window de 50ms
    expect(checkRateLimit(ip, 1, 50)).toBe(false)
    await new Promise((r) => setTimeout(r, 80))
    expect(checkRateLimit(ip, 1, 50)).toBe(true)
  })
})
```

- [ ] **Step 3.2: Lancer les tests**

Run: `npm run test -- src/lib/rate-limit.test.ts`
Expected: `3 passed`

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/rate-limit.test.ts
git commit -m "test: document legacy in-memory rate limiter behavior"
```

---

### Task 4: Tester la route API /api/contact

**Files:**
- Create: `src/app/api/contact/route.test.ts`

- [ ] **Step 4.1: Lire la route actuelle pour connaitre sa signature**

Run: `cat "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet/src/app/api/contact/route.ts"`
Noter : champs attendus dans le body, clients externes utilises (Resend, Supabase, Telegram).

- [ ] **Step 4.2: Ecrire les tests avec mocks**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks avant l'import de la route
const mockInsert = vi.fn(() => Promise.resolve({ data: null, error: null }))
const mockFrom = vi.fn(() => ({ insert: mockInsert }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const mockResendSend = vi.fn(() => Promise.resolve({ id: 'email-1' }))
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({ emails: { send: mockResendSend } })),
}))

const mockTelegramNotify = vi.fn(() => Promise.resolve())
vi.mock('@/lib/telegram', () => ({
  sendTelegramNotification: mockTelegramNotify,
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 on missing required fields', async () => {
    const res = await POST(makeRequest({ name: 'Jean' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid email', async () => {
    const res = await POST(
      makeRequest({
        name: 'Jean',
        email: 'not-an-email',
        phone: '0123456789',
        message: 'Bonjour',
      })
    )
    expect(res.status).toBe(400)
  })

  it('creates a prospect in Supabase on valid submission', async () => {
    const res = await POST(
      makeRequest({
        name: 'Jean Dupont',
        email: 'jean@example.fr',
        phone: '0123456789',
        message: 'Je souhaite un devis',
      })
    )
    expect(res.status).toBeLessThan(400)
    expect(mockFrom).toHaveBeenCalledWith('contacts')
    expect(mockInsert).toHaveBeenCalled()
  })
})
```

- [ ] **Step 4.3: Lancer les tests**

Run: `npm run test -- src/app/api/contact/route.test.ts`
Expected: 3 passed. Si le contrat de la route differe (ex: champs differents, autre table), ajuster les assertions UNIQUEMENT pour matcher le comportement reel. Ne pas modifier la route.

- [ ] **Step 4.4: Commit**

```bash
git add src/app/api/contact/route.test.ts
git commit -m "test: add API tests for POST /api/contact"
```

---

### Task 5: Tester la generation PDF (structure)

**Files:**
- Create: `src/lib/pdf/generate-quote-pdf.test.ts`

- [ ] **Step 5.1: Lister les fonctions exportees**

Run: `cat "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet/src/lib/pdf/generate-quote-pdf.ts" | head -30`
Noter le nom de la fonction principale (ex: `generateQuotePDF`) et sa signature.

- [ ] **Step 5.2: Ecrire le test de structure**

```typescript
import { describe, it, expect, vi } from 'vitest'

// jsPDF utilise le DOM, on vérifie juste qu'on produit un Buffer/Blob/Uint8Array non vide
import { generateQuotePDF } from './generate-quote-pdf'

const fakeQuote = {
  id: 'quote-1',
  numero: 'DEV-2026-001',
  client: {
    nom: 'Societe Test SA',
    adresse: '10 rue de Paris',
    code_postal: '75001',
    ville: 'Paris',
    email: 'contact@test.fr',
    siret: '12345678901234',
  },
  items: [
    {
      nom: 'Panneau Stop',
      quantite: 2,
      prix_unitaire: 120,
      total: 240,
    },
  ],
  total_ht: 240,
  tva: 48,
  total_ttc: 288,
  date: '2026-04-10',
  validite: '2026-05-10',
}

describe('generateQuotePDF', () => {
  it('returns a non-empty byte output for a valid quote', async () => {
    const result = await generateQuotePDF(fakeQuote as never)
    // jsPDF peut retourner Uint8Array, ArrayBuffer, ou Blob — on verifie juste la presence
    expect(result).toBeDefined()
    const size =
      result instanceof Uint8Array
        ? result.byteLength
        : result instanceof ArrayBuffer
          ? result.byteLength
          : (result as Blob).size
    expect(size).toBeGreaterThan(500) // un PDF vide pese ~300 bytes, un rempli >> 500
  })
})
```

- [ ] **Step 5.3: Lancer le test**

Run: `npm run test -- src/lib/pdf/generate-quote-pdf.test.ts`
Expected: 1 passed. Si `generateQuotePDF` a une signature differente, ajuster `fakeQuote` en lisant le type attendu dans le fichier source.

- [ ] **Step 5.4: Commit**

```bash
git add src/lib/pdf/generate-quote-pdf.test.ts
git commit -m "test: verify quote PDF generation produces non-empty output"
```

---

### Task 6: Creer le workflow GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 6.1: Creer le dossier workflows**

Run:
```bash
mkdir -p "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet/.github/workflows"
```

- [ ] **Step 6.2: Creer `ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Lint / Typecheck / Test / Build
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test with coverage
        run: npm run test:coverage
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://test.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key
          SUPABASE_SERVICE_ROLE_KEY: test-service-role-key
          RESEND_API_KEY: test-resend-key
          RESEND_FROM_EMAIL: noreply@test.sapal.fr
          TELEGRAM_BOT_TOKEN: test-telegram-token
          TELEGRAM_CHAT_ID: test-chat-id
          UPSTASH_REDIS_REST_URL: https://test.upstash.io
          UPSTASH_REDIS_REST_TOKEN: test-upstash-token

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://test.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key
          SUPABASE_SERVICE_ROLE_KEY: test-service-role-key
          NEXT_PUBLIC_SITE_URL: https://www.sapal.fr
```

- [ ] **Step 6.3: Valider le YAML en local**

Run:
```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet" && \
npm run lint && npm run typecheck && npm run test && npm run build
```
Expected: Les 4 commandes passent en local. Si `lint` ou `typecheck` echoue, c'est une dette pre-existante : creer un commit `chore: fix pre-existing lint/type issues` pour chaque fix necessaire.

- [ ] **Step 6.4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow (lint, typecheck, test, build)"
```

- [ ] **Step 6.5: Activer la protection de branche**

Action manuelle sur GitHub (ne pas automatiser) :
- Settings → Branches → Add rule pour `main`
- Cocher "Require status checks to pass before merging"
- Selectionner le job `quality`

---

## PHASE 2 — Rate limiting persistant avec Upstash Redis

### Task 7: Installer @upstash/ratelimit

**Files:**
- Modify: `package.json`

- [ ] **Step 7.1: Installer les packages**

Run:
```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet" && \
npm install @upstash/ratelimit @upstash/redis
```

- [ ] **Step 7.2: Creer le projet Upstash (action manuelle)**

Action utilisateur :
1. Aller sur https://console.upstash.com/
2. Creer une DB Redis gratuite (region EU)
3. Copier `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`
4. Ajouter dans `.env.local` :
   ```
   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=xxx
   ```
5. Ajouter les memes variables dans Vercel → Project Settings → Environment Variables

- [ ] **Step 7.3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @upstash/ratelimit and @upstash/redis"
```

---

### Task 8: Ecrire le test du nouveau rate limiter Upstash

**Files:**
- Create: `src/lib/rate-limit-upstash.test.ts`

- [ ] **Step 8.1: Ecrire le test avec mock Upstash**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Upstash avant import
const mockLimit = vi.fn()
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: mockLimit,
  })),
}))
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => ({})),
  },
}))

import { limitByIP, RATE_LIMITS } from './rate-limit-upstash'

describe('limitByIP', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns success + headers when under limit', async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    })
    const result = await limitByIP('1.2.3.4', 'contact')
    expect(result.success).toBe(true)
    expect(result.headers['X-RateLimit-Limit']).toBe('10')
    expect(result.headers['X-RateLimit-Remaining']).toBe('9')
    expect(result.headers['X-RateLimit-Reset']).toBeDefined()
  })

  it('returns failure when over limit', async () => {
    mockLimit.mockResolvedValueOnce({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000,
    })
    const result = await limitByIP('1.2.3.4', 'contact')
    expect(result.success).toBe(false)
    expect(result.headers['X-RateLimit-Remaining']).toBe('0')
  })

  it('exposes typed RATE_LIMITS config', () => {
    expect(RATE_LIMITS.contact).toBeDefined()
    expect(RATE_LIMITS.quotes).toBeDefined()
    expect(RATE_LIMITS.orders).toBeDefined()
    expect(RATE_LIMITS.admin).toBeDefined()
  })
})
```

- [ ] **Step 8.2: Lancer le test**

Run: `npm run test -- src/lib/rate-limit-upstash.test.ts`
Expected: 3 FAIL (module `rate-limit-upstash` n'existe pas encore).

- [ ] **Step 8.3: Commit du test rouge**

```bash
git add src/lib/rate-limit-upstash.test.ts
git commit -m "test: add failing tests for Upstash rate limiter"
```

---

### Task 9: Implementer le rate limiter Upstash

**Files:**
- Create: `src/lib/rate-limit-upstash.ts`

- [ ] **Step 9.1: Creer le fichier**

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Configuration centralisee des limites par type de route.
 * Format : [nombre de requetes, fenetre temporelle]
 */
export const RATE_LIMITS = {
  contact: { requests: 5, window: '1 h' as const },
  quotes: { requests: 10, window: '1 h' as const },
  orders: { requests: 5, window: '1 h' as const },
  admin: { requests: 60, window: '1 m' as const },
} as const

export type RateLimitKey = keyof typeof RATE_LIMITS

const redis = Redis.fromEnv()

// Un limiter par type — chaque appel utilise le bon prefix
const limiters: Record<RateLimitKey, Ratelimit> = {
  contact: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.contact.requests, RATE_LIMITS.contact.window),
    prefix: 'sapal:ratelimit:contact',
  }),
  quotes: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.quotes.requests, RATE_LIMITS.quotes.window),
    prefix: 'sapal:ratelimit:quotes',
  }),
  orders: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.orders.requests, RATE_LIMITS.orders.window),
    prefix: 'sapal:ratelimit:orders',
  }),
  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.admin.requests, RATE_LIMITS.admin.window),
    prefix: 'sapal:ratelimit:admin',
  }),
}

export interface RateLimitResult {
  success: boolean
  headers: Record<string, string>
  retryAfter?: number
}

/**
 * Verifie si une IP peut passer pour un type de route donne.
 * Retourne les headers HTTP a renvoyer et un flag succes.
 */
export async function limitByIP(
  ip: string,
  key: RateLimitKey
): Promise<RateLimitResult> {
  const limiter = limiters[key]
  const { success, limit, remaining, reset } = await limiter.limit(ip)

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(reset),
  }

  if (!success) {
    headers['Retry-After'] = String(Math.ceil((reset - Date.now()) / 1000))
  }

  return {
    success,
    headers,
    retryAfter: success ? undefined : Math.ceil((reset - Date.now()) / 1000),
  }
}

/**
 * Extrait l'IP client depuis les headers Next.js (Vercel, Cloudflare, etc.)
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  )
}
```

- [ ] **Step 9.2: Lancer les tests — doivent passer**

Run: `npm run test -- src/lib/rate-limit-upstash.test.ts`
Expected: 3 passed.

- [ ] **Step 9.3: Commit**

```bash
git add src/lib/rate-limit-upstash.ts
git commit -m "feat: implement persistent rate limiter with Upstash Redis"
```

---

### Task 10: Migrer /api/contact vers le nouveau rate limiter

**Files:**
- Modify: `src/app/api/contact/route.ts`

- [ ] **Step 10.1: Lire la route actuelle et identifier l'usage du vieux rate limiter**

Run:
```bash
cat "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet/src/app/api/contact/route.ts"
```
Noter : ligne d'import de `checkRateLimit`, ligne d'appel, reponse 429 actuelle.

- [ ] **Step 10.2: Remplacer l'import et l'appel**

Dans `src/app/api/contact/route.ts` :
- Supprimer `import { checkRateLimit } from '@/lib/rate-limit'`
- Ajouter `import { limitByIP, getClientIP } from '@/lib/rate-limit-upstash'`
- Remplacer le bloc de check existant par :

```typescript
const ip = getClientIP(request.headers)
const rl = await limitByIP(ip, 'contact')
if (!rl.success) {
  return new Response(
    JSON.stringify({
      error: 'Trop de requetes. Veuillez reessayer plus tard.',
      retryAfter: rl.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'content-type': 'application/json',
        ...rl.headers,
      },
    }
  )
}
```

Et pour les reponses de succes/erreur, ajouter `...rl.headers` dans les headers de reponse :
```typescript
return new Response(JSON.stringify({ ok: true }), {
  status: 200,
  headers: { 'content-type': 'application/json', ...rl.headers },
})
```

- [ ] **Step 10.3: Lancer les tests existants de /api/contact**

Run: `npm run test -- src/app/api/contact/route.test.ts`
Expected: Les tests existants doivent etre updates pour mocker `@/lib/rate-limit-upstash`. Ajouter en tete du fichier de test :

```typescript
vi.mock('@/lib/rate-limit-upstash', () => ({
  limitByIP: vi.fn().mockResolvedValue({
    success: true,
    headers: {
      'X-RateLimit-Limit': '5',
      'X-RateLimit-Remaining': '4',
      'X-RateLimit-Reset': String(Date.now() + 3600000),
    },
  }),
  getClientIP: vi.fn(() => '1.2.3.4'),
}))
```

Puis relancer : `npm run test -- src/app/api/contact/route.test.ts`
Expected: 3 passed.

- [ ] **Step 10.4: Commit**

```bash
git add src/app/api/contact/route.ts src/app/api/contact/route.test.ts
git commit -m "feat: migrate /api/contact to persistent Upstash rate limiter"
```

---

### Task 11: Migrer les autres routes sensibles

**Files:**
- Modify: `src/app/api/quotes/route.ts` (et toute route POST de `/api/quotes/`)
- Modify: `src/app/api/orders/route.ts` (et toute route POST de `/api/orders/`)

- [ ] **Step 11.1: Lister les routes POST existantes**

Run:
```bash
grep -rn "export async function POST" "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet/src/app/api/quotes/" \
  "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet/src/app/api/orders/"
```

- [ ] **Step 11.2: Pour chaque route POST retournee, appliquer le meme pattern qu'au Task 10**

Pour `/api/quotes/` utiliser `limitByIP(ip, 'quotes')`.
Pour `/api/orders/` utiliser `limitByIP(ip, 'orders')`.

- [ ] **Step 11.3: Supprimer l'ancien fichier rate-limit.ts**

Run:
```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet" && \
grep -rn "from '@/lib/rate-limit'" src/ middleware.ts 2>/dev/null
```
Expected: Aucune reference restante. Si oui, supprimer :
```bash
rm src/lib/rate-limit.ts src/lib/rate-limit.test.ts
```

- [ ] **Step 11.4: Lancer toute la suite de tests**

Run: `npm run test`
Expected: Tous les tests passent.

- [ ] **Step 11.5: Commit**

```bash
git add -u src/app/api/ src/lib/
git commit -m "feat: migrate quotes and orders routes to Upstash rate limiter, remove legacy"
```

---

### Task 12: Ajouter une alerte Telegram sur abus repete

**Files:**
- Modify: `src/lib/rate-limit-upstash.ts`
- Modify: `src/lib/rate-limit-upstash.test.ts`

- [ ] **Step 12.1: Ajouter un test qui verifie l'alerte Telegram**

Ajouter dans `src/lib/rate-limit-upstash.test.ts` :

```typescript
import * as telegram from './telegram'

vi.mock('./telegram', () => ({
  sendTelegramNotification: vi.fn().mockResolvedValue(undefined),
}))

describe('abuse detection', () => {
  it('triggers Telegram alert after 5 consecutive blocks in 1h', async () => {
    mockLimit.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 3600000,
    })
    for (let i = 0; i < 5; i++) {
      await limitByIP('9.9.9.9', 'contact')
    }
    // Le 5eme block doit trigger l'alerte
    expect(telegram.sendTelegramNotification).toHaveBeenCalled()
  })
})
```

- [ ] **Step 12.2: Lancer le test — doit echouer**

Run: `npm run test -- src/lib/rate-limit-upstash.test.ts`
Expected: Le nouveau test echoue (fonctionnalite non implementee).

- [ ] **Step 12.3: Implementer le compteur d'abus dans `rate-limit-upstash.ts`**

Ajouter en bas du fichier :

```typescript
import { sendTelegramNotification } from './telegram'

const ABUSE_THRESHOLD = 5
const ABUSE_WINDOW_SECONDS = 3600

async function trackAbuse(ip: string, key: RateLimitKey): Promise<void> {
  const abuseKey = `sapal:abuse:${key}:${ip}`
  const count = await redis.incr(abuseKey)
  if (count === 1) {
    await redis.expire(abuseKey, ABUSE_WINDOW_SECONDS)
  }
  if (count >= ABUSE_THRESHOLD) {
    await sendTelegramNotification(
      `Abuse detecte — IP ${ip} a atteint ${count} blocages sur ${key} en 1h`
    )
    // Reset du compteur pour eviter le spam d'alertes
    await redis.del(abuseKey)
  }
}
```

Et dans `limitByIP`, apres la detection de `!success` :
```typescript
if (!success) {
  await trackAbuse(ip, key)
  headers['Retry-After'] = String(Math.ceil((reset - Date.now()) / 1000))
}
```

- [ ] **Step 12.4: Mocker `redis.incr` / `redis.expire` / `redis.del` dans le test**

Remplacer le mock `@upstash/redis` par :
```typescript
const mockIncr = vi.fn().mockResolvedValue(5)
const mockExpire = vi.fn().mockResolvedValue(1)
const mockDel = vi.fn().mockResolvedValue(1)
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => ({
      incr: mockIncr,
      expire: mockExpire,
      del: mockDel,
    })),
  },
}))
```

- [ ] **Step 12.5: Lancer les tests**

Run: `npm run test -- src/lib/rate-limit-upstash.test.ts`
Expected: Tous passent (4+ tests).

- [ ] **Step 12.6: Commit**

```bash
git add src/lib/rate-limit-upstash.ts src/lib/rate-limit-upstash.test.ts
git commit -m "feat: add Telegram alert on repeated rate limit abuse"
```

---

## PHASE 3 — Migration des images placeholder

### Task 13: Inventaire des produits sans image

**Files:**
- Create: `scripts/audit-product-images.sql`
- Create: `scripts/audit-product-images.ts`

- [ ] **Step 13.1: Creer le script SQL d'audit**

```sql
-- scripts/audit-product-images.sql
SELECT
  id,
  nom,
  slug,
  categorie_id,
  image_url,
  CASE
    WHEN image_url IS NULL THEN 'missing'
    WHEN image_url LIKE '%placeholder%' THEN 'placeholder'
    WHEN image_url LIKE '%unsplash%' THEN 'stock'
    ELSE 'real'
  END AS status
FROM products
ORDER BY status DESC, nom ASC;
```

- [ ] **Step 13.2: Creer le script TypeScript qui execute la requete et sort un CSV**

```typescript
// scripts/audit-product-images.ts
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey)
  const { data, error } = await supabase
    .from('products')
    .select('id, nom, slug, categorie_id, image_url')
    .order('nom', { ascending: true })

  if (error) {
    console.error('Query error:', error)
    process.exit(1)
  }

  const rows = (data ?? []).map((p) => {
    const status = !p.image_url
      ? 'missing'
      : p.image_url.includes('placeholder')
        ? 'placeholder'
        : p.image_url.includes('unsplash')
          ? 'stock'
          : 'real'
    return { ...p, status }
  })

  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  console.log('Image status summary:', byStatus)

  const csv = [
    'id,nom,slug,categorie_id,image_url,status',
    ...rows.map(
      (r) =>
        `${r.id},"${r.nom.replace(/"/g, '""')}",${r.slug},${r.categorie_id},${r.image_url ?? ''},${r.status}`
    ),
  ].join('\n')

  const outPath = path.resolve('./scripts/output/product-images-audit.csv')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, csv)
  console.log(`Wrote ${rows.length} rows to ${outPath}`)
}

main()
```

- [ ] **Step 13.3: Ajouter un script npm**

Modifier `package.json`, section `"scripts"` :
```json
"audit:images": "tsx scripts/audit-product-images.ts"
```

Et installer tsx si manquant :
```bash
npm install --save-dev tsx
```

- [ ] **Step 13.4: Executer l'audit**

Run:
```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet" && npm run audit:images
```
Expected: Un summary `{ missing: X, placeholder: Y, stock: Z, real: W }` + un fichier CSV dans `scripts/output/`.

- [ ] **Step 13.5: Commit**

```bash
git add scripts/audit-product-images.sql scripts/audit-product-images.ts package.json package-lock.json
echo "scripts/output/" >> .gitignore
git add .gitignore
git commit -m "tools: add script to audit product image status"
```

---

### Task 14: Preparer le pipeline d'upload vers Supabase Storage

**Files:**
- Create: `scripts/upload-product-images.ts`

- [ ] **Step 14.1: Installer sharp pour la conversion WebP**

Run:
```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet" && \
npm install --save-dev sharp
```

- [ ] **Step 14.2: Creer le script d'upload**

```typescript
// scripts/upload-product-images.ts
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import * as fs from 'node:fs'
import * as path from 'node:path'

const BUCKET = 'products'
const SOURCE_DIR = path.resolve('./scripts/input/product-images')

interface ImageJob {
  productSlug: string
  categorySlug: string
  sourceFile: string
}

async function loadJobs(): Promise<ImageJob[]> {
  // Format attendu : scripts/input/product-images/{categorySlug}/{productSlug}.{jpg|png|webp}
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source dir missing: ${SOURCE_DIR}`)
    process.exit(1)
  }
  const jobs: ImageJob[] = []
  for (const category of fs.readdirSync(SOURCE_DIR)) {
    const catPath = path.join(SOURCE_DIR, category)
    if (!fs.statSync(catPath).isDirectory()) continue
    for (const file of fs.readdirSync(catPath)) {
      if (!/\.(jpe?g|png|webp)$/i.test(file)) continue
      jobs.push({
        categorySlug: category,
        productSlug: path.parse(file).name,
        sourceFile: path.join(catPath, file),
      })
    }
  }
  return jobs
}

async function convertToWebP(sourceFile: string): Promise<Buffer> {
  return sharp(sourceFile)
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey)
  const jobs = await loadJobs()
  console.log(`Found ${jobs.length} images to upload.`)

  let ok = 0
  let failed = 0

  for (const job of jobs) {
    const destPath = `${job.categorySlug}/${job.productSlug}.webp`
    console.log(`Processing ${destPath}...`)
    try {
      const buffer = await convertToWebP(job.sourceFile)
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(destPath, buffer, {
          contentType: 'image/webp',
          upsert: true,
        })
      if (uploadError) throw uploadError

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(destPath)
      const publicUrl = pub.publicUrl

      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('slug', job.productSlug)
      if (updateError) throw updateError

      console.log(`  OK -> ${publicUrl}`)
      ok++
    } catch (e) {
      console.error(`  FAIL:`, e)
      failed++
    }
  }

  console.log(`\nDone. OK=${ok} FAIL=${failed}`)
}

main()
```

- [ ] **Step 14.3: Ajouter le script npm**

Modifier `package.json` section `"scripts"` :
```json
"upload:images": "tsx scripts/upload-product-images.ts"
```

- [ ] **Step 14.4: Ajouter le dossier input au .gitignore**

Run:
```bash
echo "scripts/input/" >> "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet/.gitignore"
```

- [ ] **Step 14.5: Verifier que le bucket `products` existe dans Supabase**

Action manuelle : ouvrir le dashboard Supabase → Storage → Buckets → verifier qu'un bucket `products` existe en public. Si non : le creer (public read, RLS sur write via service role uniquement).

- [ ] **Step 14.6: Commit**

```bash
git add scripts/upload-product-images.ts package.json package-lock.json .gitignore
git commit -m "tools: add WebP upload pipeline for product images"
```

---

### Task 15: Lancer la migration d'images (execution reelle)

**Files:**
- Utilise: `scripts/input/product-images/{categorie}/{slug}.jpg`

- [ ] **Step 15.1: Organiser les sources d'images**

Action manuelle : placer les photos reelles fournies par le client dans :
```
scripts/input/product-images/
  signalisation/
    panneau-stop.jpg
    panneau-danger.jpg
  mobilier-urbain/
    banc-public.jpg
  ...
```

Pour chaque categorie qui n'a pas de photos reelles, utiliser le catalogue fournisseur ou une photo generique.

- [ ] **Step 15.2: Faire un dry-run sur 2-3 images de test**

Placer 2-3 images de test, puis :
```bash
cd "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet" && npm run upload:images
```
Expected: Les 2-3 images sont uploadees, la DB est mise a jour, les URLs sont accessibles.

- [ ] **Step 15.3: Verifier en production (staging)**

Ouvrir la page catalogue sur l'env de preview Vercel et confirmer que les 2-3 images apparaissent.

- [ ] **Step 15.4: Lancer l'import complet**

Apres validation visuelle :
```bash
npm run upload:images
```
Expected: `Done. OK=X FAIL=0`. Tout echec doit etre investigue avant de continuer.

- [ ] **Step 15.5: Re-lancer l'audit pour verifier**

```bash
npm run audit:images
```
Expected: `{ missing: 0, placeholder: 0, stock: 0, real: 335 }` (ou close).

- [ ] **Step 15.6: Commit le log de migration**

```bash
cp scripts/output/product-images-audit.csv scripts/output/product-images-audit-post-migration.csv
git add scripts/output/product-images-audit-post-migration.csv -f
git commit -m "data: migrate all product images to WebP in Supabase Storage"
```

---

### Task 16: Optimisation next/image sur le catalogue

**Files:**
- Modify: `src/components/**/ProductCard.tsx` (ou equivalent)
- Modify: `next.config.ts`

- [ ] **Step 16.1: Trouver le composant ProductCard**

Run:
```bash
grep -rn "image_url" "/Users/pierrelaurent/Desktop/OptiPro/Clients/SAPAL/Site internet/src/components/" | grep -i "img\|Image"
```

- [ ] **Step 16.2: S'assurer que `next/image` est utilise avec les bons attributs**

Pour chaque usage d'image produit, verifier la presence de :
- `sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"`
- `alt={product.nom}` (jamais vide)
- `priority` uniquement sur les images above-the-fold (hero, top 3 du catalogue)
- `loading="lazy"` sur les autres (implicite par defaut)

- [ ] **Step 16.3: Ajouter le hostname Supabase dans `next.config.ts` remotePatterns**

Verifier que `next.config.ts` contient :
```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '*.supabase.co',
      pathname: '/storage/v1/object/public/**',
    },
  ],
},
```
Si absent, l'ajouter.

- [ ] **Step 16.4: Build et verifier que ca compile**

Run: `npm run build`
Expected: Build reussit sans erreur.

- [ ] **Step 16.5: Lancer Lighthouse en local**

Action manuelle : `npm run start` puis Chrome DevTools → Lighthouse → mobile → Performance.
Expected: Score Performance > 85 sur la page catalogue.

- [ ] **Step 16.6: Commit**

```bash
git add -u
git commit -m "perf: optimize product images with next/image sizes + priority"
```

---

## CRITERES DE VALIDATION GLOBAUX

Une fois toutes les phases completees, verifier :

- [ ] **Tests** : `npm run test:coverage` affiche > 40% statements, > 25 tests
- [ ] **CI** : La derniere action GitHub est verte sur la branche main
- [ ] **Rate limiting** : Test manuel — 10 POST /api/contact rapides → le 6eme doit retourner 429 avec headers `X-RateLimit-*` et `Retry-After`
- [ ] **Rate limiting persistance** : Redeployer sur Vercel, refaire le test — le compteur ne doit PAS etre reset
- [ ] **Images** : `npm run audit:images` retourne `{ missing: 0, placeholder: 0 }`
- [ ] **Lighthouse** : Score Performance > 85 sur la page catalogue mobile
- [ ] **Build** : `npm run build` reussit sans warning TypeScript

---

## SUITE APRES CE PLAN

Plans a creer apres execution de celui-ci (actions P1 et P2 du doc correctif) :
- `2026-XX-XX-plan-pennylane-activation.md` — Action 4 : activer l'integration Pennylane avec queue de retry
- `2026-XX-XX-plan-pwa-mobile.md` — Action 5 : service worker robuste + optimisations mobile + push notifications

**Effort estime pour ce plan (Phases 1-3) : 8-12 jours ouvres.**
