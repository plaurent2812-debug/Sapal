import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';

export interface DownloadResult {
  absolutePath: string;
  relativeName: string;
  sha256: string;
  bytes: number;
  skipped: boolean;
}

/**
 * Télécharge `url` vers `targetDir/filename` si pas déjà présent (idempotent).
 * Throws si la réponse HTTP n'est pas 2xx.
 */
export async function downloadMedia(
  url: string,
  targetDir: string,
  filename: string,
): Promise<DownloadResult> {
  const absolutePath = join(targetDir, filename);
  if (existsSync(absolutePath)) {
    return { absolutePath, relativeName: filename, sha256: '', bytes: 0, skipped: true };
  }
  await mkdir(dirname(absolutePath), { recursive: true });

  const res = await fetch(url, {
    headers: { 'User-Agent': 'SAPAL-Mirror/1.0 (+mailto:societe@sapal.fr)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Download ${url} failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(absolutePath, buf);

  return {
    absolutePath,
    relativeName: filename,
    sha256: createHash('sha256').update(buf).digest('hex'),
    bytes: buf.length,
    skipped: false,
  };
}

/**
 * Extrait un filename propre depuis une URL. Enlève query string, fallback 'unknown'.
 */
export function filenameFromUrl(url: string): string {
  const clean = url.split('?')[0].split('#')[0];
  return clean.split('/').pop() || 'unknown';
}
