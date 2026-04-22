import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import type { ScraperState } from './types';

/**
 * Persistance du progrès du scraper. Fichier unique `state.json` stockant le hash du contenu
 * de chaque produit déjà traité, pour permettre reprise incrémentale (skip si hash inchangé).
 */
export class StateManager {
  private state: ScraperState;

  constructor(private readonly filePath: string) {
    this.state = {
      version: 1,
      runStartedAt: new Date().toISOString(),
      entries: {},
    };
  }

  async load(): Promise<void> {
    if (!existsSync(this.filePath)) return;
    const raw = await readFile(this.filePath, 'utf-8');
    try {
      this.state = JSON.parse(raw);
    } catch {
      console.warn(`[state] failed to parse ${this.filePath}, starting fresh`);
    }
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2));
  }

  shouldSkip(reference: string, hash: string): boolean {
    return this.state.entries[reference]?.hash === hash;
  }

  record(reference: string, hash: string): void {
    this.state.entries[reference] = {
      hash,
      lastSeenAt: new Date().toISOString(),
    };
  }

  size(): number {
    return Object.keys(this.state.entries).length;
  }
}
