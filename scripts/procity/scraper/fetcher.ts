import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

export interface FetchedPage {
  url: string;
  html: string;
  /** Map combination-key -> URL image principale observee apres selection de cette combinaison */
  combinationImages: Map<string, string>;
  /** Toutes les URLs absolues d'images trouvees (produit, galerie, swatches) */
  imageLinks: string[];
  /** Liens PDF trouves (visibles seulement apres login revendeur) */
  pdfLinks: string[];
  /** Contenu binaire des images variantes captées au fil du réseau (URL → bytes). */
  imageBodies: Map<string, Buffer>;
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetcher Procity avec session authentifiee persistante (cookies partages entre pages).
 * L'authentification est faite UNE FOIS au start, puis chaque fetchPage reutilise la session.
 */
export class ProcityFetcher {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private authenticated = false;

  async start(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({ userAgent: USER_AGENT });

    const login = process.env.PROCITY_LOGIN;
    const password = process.env.PROCITY_PASSWORD;
    if (login && password) {
      const page = await this.context.newPage();
      try {
        await page.goto('https://www.procity.eu/fr/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.fill('#email', login);
        await page.fill('#password', password);
        await page.locator('form:has(input[name="thelia_customer_login[email]"]) button[type="submit"]').click();
        await page.waitForTimeout(3000);
        const url = page.url();
        if (url.includes('/account')) {
          this.authenticated = true;
          console.log('[fetcher] authenticated as', login);
        } else {
          console.warn('[fetcher] login failed, URL =', url);
        }
      } catch (err) {
        console.warn('[fetcher] login error:', (err as Error).message);
      } finally {
        await page.close();
      }
    } else {
      console.log('[fetcher] no PROCITY_LOGIN/PASSWORD in env — scraping anonymously');
    }
  }

  async stop(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.context = null;
    this.browser = null;
    this.authenticated = false;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  async fetchPage(url: string): Promise<FetchedPage> {
    if (!this.context) throw new Error('Fetcher not started');
    const page = await this.context.newPage();

    // Enregistrer toutes les URLs d'images variantes vues par le navigateur.
    // Procity ne met l'image d'une variante dans le DOM qu'après clic sur la
    // combinaison correspondante. En écoutant le réseau, on capte tout ET on
    // récupère le body directement (pour éviter de re-télécharger sans cookie de
    // session — Procity refuse les requêtes anonymes pour les images revendeur).
    const networkImages = new Set<string>();
    const imageBodies = new Map<string, Buffer>();
    const bodyPromises: Promise<void>[] = [];
    page.on('response', (response) => {
      const reqUrl = response.url();
      if (/\/cache\/images\/product\/[a-f0-9]{32}-\d{6,}_[a-z0-9]+_\d+\.(webp|jpg|jpeg|png)$/i.test(reqUrl)) {
        if (response.ok()) {
          networkImages.add(reqUrl);
          // Capturer le body en asynchrone (ne pas bloquer le event loop)
          bodyPromises.push(
            response
              .body()
              .then((buf) => {
                if (buf && buf.length > 500) imageBodies.set(reqUrl, buf);
              })
              .catch(() => {}),
          );
        }
      }
    });
    const pageUrlForLog = url;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      try {
        await page.waitForLoadState('networkidle', { timeout: 8_000 });
      } catch {
        // Procity a des scripts tiers qui ne idle jamais — pas grave
      }

      const combinationImages = await captureCombinationImages(page);
      const html = await page.content();
      const imageLinks = await page.$$eval('img', (imgs) =>
        imgs
          .map((i) => (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src)
          .filter(Boolean),
      );
      // Ajouter les URLs d'images variantes captées au fil des requêtes réseau
      // (Procity les charge à la demande lors des clics, elles n'apparaissent donc
      // pas dans le DOM final).
      let added = 0;
      for (const u of networkImages) {
        if (!imageLinks.includes(u)) { imageLinks.push(u); added++; }
      }
      console.log(`[fetcher] ${pageUrlForLog}: ${networkImages.size} images captées, ${imageBodies.size} bodies sauvés`);
      // Attendre que tous les bodies soient téléchargés
      await Promise.all(bodyPromises);
      const pdfLinks = await page.$$eval('a[href$=".pdf"]', (links) =>
        links.map((l) => (l as HTMLAnchorElement).href),
      );

      return { url, html, combinationImages, imageLinks, pdfLinks, imageBodies };
    } finally {
      await page.close();
    }
  }
}

/**
 * Capture les images des variantes en parcourant chaque combinaison :
 * - pour chaque swatch couleur (button.PseSelector-btn)
 * - pour chaque combinaison des dropdowns variantes (Longueur, Structure, Structure autre)
 * On clique sur chaque combinaison, on attend le changement d'image, on l'enregistre.
 * La cle est une chaine "couleur||select1=val1||select2=val2..." qui identifie uniquement la combinaison.
 */
async function captureCombinationImages(page: Page): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  // 1. Identifier les selects de VARIANTES (Longueur, Structure, Structure autre, etc.)
  //    Procity expose toutes les options valides dans la variable JS ATTRIBUTES au chargement,
  //    on l'utilise pour savoir quels selects sont des variantes (via le titre).
  //    Fallback : heuristique sur les options.
  const attrNames: string[] = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const match = html.match(/var\s+ATTRIBUTES\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return [];
    try {
      const attrs = JSON.parse(match[1]) as Array<{ title: string; values: unknown[] }>;
      return attrs.filter((a) => Array.isArray(a.values) && a.values.length > 0).map((a) => a.title);
    } catch {
      return [];
    }
  });

  const variantSelects = await page.$$eval(
    'select',
    (sels: HTMLSelectElement[], knownTitles: string[]) => {
      // Heuristique pour detecter les selects de variante : labels correspondant aux titres
      // ATTRIBUTES, ou nombre d'options raisonnable sans mots-cles pays/civilite.
      const COUNTRY_KEYWORDS = ['france', 'allemagne', 'belgique', 'suisse', 'italie', 'espagne'];
      const CIVILITY_KEYWORDS = ['mme', 'mlle', 'aucun'];
      return sels
        .filter((s) => {
          const options = Array.from(s.options);
          if (options.length < 2) return false;
          const texts = options.map((o) => (o.textContent || '').trim().toLowerCase());
          if (texts.some((t) => COUNTRY_KEYWORDS.some((k) => t.includes(k)))) return false;
          if (texts.some((t) => CIVILITY_KEYWORDS.some((k) => t.includes(k)))) return false;
          if (options.length > 15) return false; // les selects variantes ont peu d'options
          return true;
        })
        .map((s) => ({
          name: s.name || s.id || '',
          index: Array.from(document.querySelectorAll('select')).indexOf(s),
          // Valeurs de chaque option (hors option vide)
          options: Array.from(s.options)
            .filter((o) => o.value && (o.textContent || '').trim() !== '')
            .map((o) => ({ value: o.value, label: (o.textContent || '').trim() })),
        }))
        .filter((s) => s.options.length > 0);
    },
    attrNames,
  );

  // 2. Swatches couleur
  const colorLabels: string[] = [];
  const swatchCount = await page.locator('button.PseSelector-btn').count();
  for (let i = 0; i < swatchCount; i++) {
    const label = ((await page.locator('button.PseSelector-btn').nth(i).textContent()) || '').trim();
    if (label) colorLabels.push(label);
  }

  // 3. Produit cartesien des options variantes
  const optionTuples = cartesian(
    variantSelects.map((s) =>
      s.options.map((o) => ({ name: s.name, index: s.index, value: o.value, label: o.label })),
    ),
  );
  const combos = optionTuples.length > 0 ? optionTuples : [[]];
  const colors: (string | null)[] = colorLabels.length > 0 ? colorLabels : [null];

  // 4. Pour chaque (couleur, combination), appliquer + attendre + capturer
  const mainImgLocator = page.locator('.ProductGallery-img--1, .ProductGallery-img, [itemprop="image"]').first();

  // Obtenir image initiale pour detecter les changements
  let lastSeenSrc: string | null = await mainImgLocator
    .evaluate((el: Element) => (el as HTMLImageElement).src || null)
    .catch(() => null);

  for (const color of colors) {
    if (color) {
      const swatch = page.locator('button.PseSelector-btn', { hasText: color }).first();
      try {
        await swatch.click({ timeout: 3_000 });
      } catch {
        continue;
      }
      // Attendre que l'image change
      await waitForImageChange(page, mainImgLocator, lastSeenSrc, 2000);
      lastSeenSrc = await mainImgLocator
        .evaluate((el: Element) => (el as HTMLImageElement).src || null)
        .catch(() => null);
    }

    for (const combo of combos) {
      // Appliquer chaque select
      for (const { index, value } of combo) {
        const select = page.locator('select').nth(index);
        try {
          await select.selectOption(value, { timeout: 2_000 });
        } catch {
          // option indisponible pour cette combinaison — skip
        }
      }
      // Attendre le changement d'image (critique : Procity prend ~1s pour recalculer)
      await waitForImageChange(page, mainImgLocator, lastSeenSrc, 2000);

      const mainImg = await mainImgLocator
        .evaluate((el: Element) => {
          const img = el as HTMLImageElement;
          return img.currentSrc || img.src || null;
        })
        .catch(() => null);

      if (mainImg) {
        const key = buildKey(color, combo);
        result.set(key, mainImg);
        lastSeenSrc = mainImg;
      }
    }
  }

  return result;
}

async function waitForImageChange(
  page: Page,
  locator: ReturnType<Page['locator']>,
  previousSrc: string | null,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const current = await locator
      .evaluate((el: Element) => (el as HTMLImageElement).src || null)
      .catch(() => null);
    if (current !== previousSrc) return;
    await page.waitForTimeout(150);
  }
}

function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])),
    [[]],
  );
}

function buildKey(
  color: string | null,
  combo: Array<{ name?: string; value: string; label?: string }>,
): string {
  const parts: string[] = [];
  if (color) parts.push(`color=${color}`);
  for (const c of combo) {
    const key = c.name || `sel`;
    const val = c.label || c.value;
    parts.push(`${key}=${val}`);
  }
  return parts.join('||');
}

/**
 * Execute `fn` et garantit qu'il ne termine pas avant `minDelayMs`.
 */
export async function throttle<T>(fn: () => Promise<T>, minDelayMs = 2000): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  if (elapsed < minDelayMs) {
    await new Promise((r) => setTimeout(r, minDelayMs - elapsed));
  }
  return result;
}
