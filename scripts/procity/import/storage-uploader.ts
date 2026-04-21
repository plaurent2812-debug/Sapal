import { readFile } from 'fs/promises';
import { extname } from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'supplier-media';

function inferContentType(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

export async function uploadMedia(
  supabase: SupabaseClient,
  localPath: string,
  remotePath: string,
): Promise<string> {
  const buf = await readFile(localPath);
  const contentType = inferContentType(localPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(remotePath, buf, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload ${remotePath}: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(remotePath);
  return data.publicUrl;
}

export function buildMediaPath(
  supplierSlug: string,
  reference: string,
  kind: 'gallery' | 'variants' | 'tech-sheet',
  filename: string,
): string {
  if (kind === 'tech-sheet') {
    return `${supplierSlug}/products/${reference}/tech-sheet.pdf`;
  }
  return `${supplierSlug}/products/${reference}/${kind}/${filename}`;
}
