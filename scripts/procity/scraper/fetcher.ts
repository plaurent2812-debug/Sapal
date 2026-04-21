import { chromium, type Browser, type Page } from 'playwright';

export interface FetchedPage {
  url: string;
  html: string;
  /** label (couleur) -> URL absolue de l'image principale affichee apres clic sur ce swatch */
  variantImages: Map<string, string>;
  /** toutes les URLs absolues d'images trouvees (produit, galerie, swatches) */
  imageLinks: string[];
  /** liens PDF trouves (pour info — Procity bloque le telechargement public par robots.txt) */
  pdfLinks: string[];
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) SAPAL-Mirror/1.0 Safari/537.36';

export class ProcityFetcher {
  private browser: Browser | null = null;

  async start(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
  }

  async stop(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }

  async fetchPage(url: string): Promise<FetchedPage> {
    if (!this.browser) throw new Error('Fetcher not started');
    const context = await this.browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      try {
        await page.waitForLoadState('networkidle', { timeout: 8_000 });
      } catch {
        // pas grave : certaines pages Procity ont des scripts tiers qui ne idle jamais
      }

      const variantImages = await captureVariantImages(page);
      const html = await page.content();
      const imageLinks = await page.$$eval('img', (imgs) =>
        imgs
          .map((i) => (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src)
          .filter(Boolean),
      );
      const pdfLinks = await page.$$eval('a[href$=".pdf"]', (links) =>
        links.map((l) => (l as HTMLAnchorElement).href),
      );

      return { url, html, variantImages, imageLinks, pdfLinks };
    } finally {
      await page.close();
      await context.close();
    }
  }
}

/**
 * Clique chaque swatch de couleur, observe l'image principale qui apparait, capture l'URL.
 * Tolerant aux erreurs : un swatch non cliquable n'interrompt pas le processus.
 */
async function captureVariantImages(page: Page): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  const swatchLocator = page.locator('button.PseSelector-btn');
  const count = await swatchLocator.count();
  for (let i = 0; i < count; i++) {
    const swatch = swatchLocator.nth(i);
    const label = ((await swatch.textContent()) || '').trim();
    if (!label) continue;

    try {
      await swatch.click({ timeout: 3_000 });
      await page.waitForTimeout(400);
      const mainImgHandle = page
        .locator('.ProductGallery-img--1, .ProductGallery-img, [itemprop="image"]')
        .first();
      const mainImg: string | null = await mainImgHandle
        .evaluate((el: Element) => {
          const img = el as HTMLImageElement;
          return img.currentSrc || img.src || null;
        })
        .catch(() => null);
      if (mainImg) result.set(label, mainImg);
    } catch {
      // swatch pas cliquable sur cette page : on ignore
    }
  }

  return result;
}

/**
 * Execute `fn` et garantit qu'il ne termine pas avant `minDelayMs`. Utilise par l'orchestrateur
 * pour throttler les requetes vers Procity (1 req / 2s par defaut).
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
