import { readdir } from 'fs/promises';

export interface ParsedFilename {
  references: string[];
  label: string | null;
  raw: string;
}

const FULL_PATTERN_REGEX = /^(\d{3})\s*-\s*(?:([^-]+?)\s*-\s*)?((?:\d{5,7}\+?)+)(?:\s+[A-Za-z0-9]+)?\.(?:jpg|jpeg|png|webp)$/i;
const ANY_REF_REGEX = /(\d{5,7})/g;

export function parseLocalImageFilename(filename: string): ParsedFilename | null {
  const full = FULL_PATTERN_REGEX.exec(filename);
  if (full) {
    return {
      raw: filename,
      label: full[2]?.trim() || null,
      references: full[3].split('+').filter(Boolean),
    };
  }
  const refs = [...filename.matchAll(ANY_REF_REGEX)].map((m) => m[1]);
  if (refs.length === 0) return null;
  return { raw: filename, label: null, references: refs };
}

export function matchImagesForReference(
  reference: string,
  allFilenames: string[],
): string[] {
  return allFilenames.filter((f) => {
    const parsed = parseLocalImageFilename(f);
    return parsed?.references.includes(reference);
  });
}

export async function loadLocalPhotoIndex(rootDir: string): Promise<string[]> {
  const files = await readdir(rootDir);
  return files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
}
