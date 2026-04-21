import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractProductSnapshot } from '../extractor';

const fixtureHtml = readFileSync(
  join(__dirname, 'fixtures/abri-chariots-modulo.html'),
  'utf-8',
);

const url = 'https://procity.eu/fr/abri-chariots-modulo-1.html';

describe('extractProductSnapshot — Abri Chariots Modulo fixture', () => {
  it('extracts reference and title', () => {
    const s = extractProductSnapshot({ html: fixtureHtml, url });
    expect(s.reference).toBe('529777');
    expect(s.title).toBe('Abri chariots Modulo');
  });

  it('detects universe + category path', () => {
    const s = extractProductSnapshot({ html: fixtureHtml, url });
    expect(s.universe).toBe('mobilier-urbain');
    expect(s.categoryPath).toContain('Mobilier urbain');
  });

  it('extracts description (includes the meta intro phrase)', () => {
    const s = extractProductSnapshot({ html: fixtureHtml, url });
    expect(s.descriptionRaw.length).toBeGreaterThan(100);
    expect(s.descriptionRaw.toLowerCase()).toContain('chariots');
  });

  it('extracts availability "5 semaines"', () => {
    const s = extractProductSnapshot({ html: fixtureHtml, url });
    expect(s.availabilityDefault).toBe('5 semaines');
  });

  it('extracts weight 550 kg', () => {
    const s = extractProductSnapshot({ html: fixtureHtml, url });
    expect(s.weightKg).toBe(550);
  });

  it('extracts characteristics (dimensions, structure, toiture…)', () => {
    const s = extractProductSnapshot({ html: fixtureHtml, url });
    const labels = s.characteristics.map((c) => c.label.toLowerCase());
    expect(labels).toContain('dimensions');
    expect(labels).toContain('structure');
    expect(labels.some((l) => l.includes('coloris'))).toBe(true);
  });

  it('extracts all 20 variants with refs, colors, availability', () => {
    const s = extractProductSnapshot({ html: fixtureHtml, url });
    expect(s.variants.length).toBe(20);

    const grisProcity = s.variants.find((v) => v.variantRef === '529777.GPRO');
    expect(grisProcity).toBeDefined();
    expect(grisProcity?.attributes.Couleur).toBe('Gris Procity');
    expect(grisProcity?.attributes['Structure autre']).toBe('Scellement direct');
    expect(grisProcity?.availability).toBe('5 semaines');

    const colors = new Set(s.variants.map((v) => v.attributes.Couleur));
    expect(colors.has('RAL 9010')).toBe(true);
    expect(colors.has('Aspect Corten')).toBe(true);
    expect(colors.size).toBe(10);
  });

  it('extracts gallery image filenames', () => {
    const s = extractProductSnapshot({ html: fixtureHtml, url });
    expect(s.galleryFilenames.length).toBeGreaterThan(0);
    expect(s.galleryFilenames.some((f) => f.includes('529777'))).toBe(true);
  });

  it('produces a stable contentHash', () => {
    const a = extractProductSnapshot({ html: fixtureHtml, url });
    const b = extractProductSnapshot({ html: fixtureHtml, url });
    expect(a.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(a.contentHash).toBe(b.contentHash);
  });
});
