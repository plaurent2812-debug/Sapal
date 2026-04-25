import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseTarifExcel, groupByProduct } from '../excel-parser';

const DEFAULT_EXCEL_PATH = path.resolve(
  __dirname,
  '../../../../../Fournisseurs/Procity/tarifprocityvialux2026-fr.v1.7-699.xlsx'
);
const EXCEL_PATH = process.env.PROCITY_TARIF_EXCEL_PATH || DEFAULT_EXCEL_PATH;
const describeWithExcel = existsSync(EXCEL_PATH) ? describe : describe.skip;

describeWithExcel('parseTarifExcel — fichier réel', () => {
  it('parse plus de 1500 lignes variantes', async () => {
    const rows = await parseTarifExcel(EXCEL_PATH);
    expect(rows.length).toBeGreaterThan(1500);
  });

  it('chaque ligne a une reference ; majorité ont une procityUrl', async () => {
    const rows = await parseTarifExcel(EXCEL_PATH);
    for (const r of rows) expect(r.reference).toMatch(/^\d{4,7}$/);
    const withUrl = rows.filter((r) => r.procityUrl);
    // ~80% des lignes ont une URL publique, le reste = produits hors catalogue web
    expect(withUrl.length).toBeGreaterThan(rows.length * 0.7);
    for (const r of withUrl) expect(r.procityUrl).toContain('procity.eu');
  });

  it('produit 529777 (Abri Chariots Modulo) est présent et correct', async () => {
    const rows = await parseTarifExcel(EXCEL_PATH);
    const modulo = rows.find((r) => r.reference === '529777');
    expect(modulo).toBeDefined();
    expect(modulo?.procityUrl).toContain('abri-chariots-modulo');
    expect(modulo?.category).toContain('ACCÈS');
    expect(modulo?.weightKg).toBeGreaterThan(0);
    expect(modulo?.priceNetHt).toBeGreaterThan(0);
  });
});

describeWithExcel('groupByProduct', () => {
  it('regroupe plus de 1500 produits uniques avec leurs variantes', async () => {
    const rows = await parseTarifExcel(EXCEL_PATH);
    const products = groupByProduct(rows);
    expect(products.length).toBeGreaterThan(1500);
    expect(products.every((p) => p.variants.length >= 1)).toBe(true);
  });

  it('produit 206200 (Lisbonne) a plusieurs variantes de coloris', async () => {
    const rows = await parseTarifExcel(EXCEL_PATH);
    const products = groupByProduct(rows);
    const lisbonne = products.find((p) => p.reference === '206200');
    expect(lisbonne).toBeDefined();
    expect(lisbonne!.variants.length).toBeGreaterThanOrEqual(3);
    const coloris = new Set(lisbonne!.variants.map((v) => v.coloris));
    expect(coloris.has('Standard')).toBe(true);
  });

  it('repartition univers cohérente', async () => {
    const rows = await parseTarifExcel(EXCEL_PATH);
    const products = groupByProduct(rows);
    const byUniverse = products.reduce<Record<string, number>>((acc, p) => {
      acc[p.universe] = (acc[p.universe] || 0) + 1;
      return acc;
    }, {});
    expect(byUniverse['mobilier-urbain']).toBeGreaterThan(1000);
    expect(byUniverse['aires-de-jeux']).toBeGreaterThan(100);
    expect(byUniverse['equipements-sportifs']).toBeGreaterThan(20);
  });
});
