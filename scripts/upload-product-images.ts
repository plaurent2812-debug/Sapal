/**
 * upload-product-images.ts
 *
 * Converts source images to WebP and uploads them to Supabase Storage,
 * then updates the image_url column in the products table.
 *
 * Naming convention: {reference}.jpg / {reference}.png (e.g. SAP-PANN-001.jpg)
 * If no match by reference, falls back to slug matching.
 *
 * Usage:
 *   npx tsx scripts/upload-product-images.ts ./scripts/images/
 *   npx tsx scripts/upload-product-images.ts ./scripts/images/ --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readdirSync, readFileSync, statSync } from 'fs'
import { extname, basename, join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Env loading (same pattern as audit-images.ts)
// ---------------------------------------------------------------------------

function loadEnvFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // File may not exist; env vars may already be set
  }
}

loadEnvFile(join(__dirname, '..', '.env.local'))

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'products'
const WEBP_QUALITY = 80
const MAX_WIDTH = 800
const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const MAX_SOURCE_SIZE_MB = 10

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const sourceDir = args.find(a => !a.startsWith('--'))

if (!sourceDir) {
  console.error('Usage: npx tsx scripts/upload-product-images.ts <source-dir> [--dry-run]')
  process.exit(1)
}

const sourceDirAbs = resolve(sourceDir)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductRow {
  id: string
  slug: string
  reference: string | null
  image_url: string | null
  categories: { slug: string } | null
}

type UploadResult =
  | { status: 'uploaded'; file: string; reference: string; sizeKb: string }
  | { status: 'skipped_dry_run'; file: string; reference: string; sizeKb: string }
  | { status: 'not_found'; file: string }
  | { status: 'too_large'; file: string; sizeMb: string }
  | { status: 'error'; file: string; message: string }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatKb(bytes: number): string {
  return (bytes / 1024).toFixed(1)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (dryRun) {
    console.log('[DRY RUN] No files will be uploaded or database rows updated.\n')
  }

  // 1. Load all products with their category slug
  console.log('Fetching products from Supabase...')
  const { data: products, error: dbError } = await supabase
    .from('products')
    .select('id, slug, reference, image_url, categories(slug)')
    .order('name', { ascending: true })

  if (dbError) {
    console.error('Supabase query error:', dbError.message)
    process.exit(1)
  }

  if (!products || products.length === 0) {
    console.log('No products found in database.')
    process.exit(0)
  }

  // Build lookup maps
  const byReference = new Map<string, ProductRow>()
  const bySlug = new Map<string, ProductRow>()

  for (const p of products as ProductRow[]) {
    if (p.reference) {
      byReference.set(p.reference.toUpperCase(), p)
    }
    bySlug.set(p.slug, p)
  }

  // 2. Scan source directory
  let files: string[]
  try {
    files = readdirSync(sourceDirAbs).filter(f => {
      const ext = extname(f).toLowerCase()
      return SUPPORTED_EXTS.has(ext) && !f.startsWith('.')
    })
  } catch {
    console.error(`Cannot read directory: ${sourceDirAbs}`)
    process.exit(1)
  }

  if (files.length === 0) {
    console.log(`No supported image files found in: ${sourceDirAbs}`)
    process.exit(0)
  }

  console.log(`Found ${files.length} image file(s) in ${sourceDirAbs}\n`)

  // 3. Process each file
  const results: UploadResult[] = []

  for (const file of files) {
    const filePath = join(sourceDirAbs, file)
    const ext = extname(file).toLowerCase()
    const nameWithoutExt = basename(file, ext)

    // Check file size
    const stat = statSync(filePath)
    const sizeMb = stat.size / (1024 * 1024)
    if (sizeMb > MAX_SOURCE_SIZE_MB) {
      console.log(`  SKIP  ${file} — file too large (${sizeMb.toFixed(1)} MB > ${MAX_SOURCE_SIZE_MB} MB)`)
      results.push({ status: 'too_large', file, sizeMb: sizeMb.toFixed(1) })
      continue
    }

    // Resolve product: try reference first, then slug
    const referenceKey = nameWithoutExt.toUpperCase()
    const slugKey = slugify(nameWithoutExt)

    const product = byReference.get(referenceKey) ?? bySlug.get(slugKey) ?? null

    if (!product) {
      console.log(`  NOT_FOUND  ${file} — no product matched (tried reference="${referenceKey}", slug="${slugKey}")`)
      results.push({ status: 'not_found', file })
      continue
    }

    const matchedRef = product.reference ?? product.slug
    const categorySlug = product.categories?.slug ?? 'uncategorized'
    const storagePath = `${categorySlug}/${product.slug}.webp`

    try {
      // Convert to WebP
      const webpBuffer = await sharp(filePath)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer()

      const sizeKb = formatKb(webpBuffer.length)

      if (dryRun) {
        console.log(`  DRY_RUN  ${matchedRef} — would upload to ${BUCKET}/${storagePath} (${sizeKb} KB)`)
        results.push({ status: 'skipped_dry_run', file, reference: matchedRef, sizeKb })
        continue
      }

      // Upload to Supabase Storage (upsert = overwrite)
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, webpBuffer, {
          contentType: 'image/webp',
          upsert: true,
        })

      if (uploadError) {
        console.log(`  ERROR  ${matchedRef} — upload failed: ${uploadError.message}`)
        results.push({ status: 'error', file, message: uploadError.message })
        continue
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath)

      const publicUrl = urlData.publicUrl

      // Update products table
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('id', product.id)

      if (updateError) {
        console.log(`  ERROR  ${matchedRef} — DB update failed: ${updateError.message}`)
        results.push({ status: 'error', file, message: updateError.message })
        continue
      }

      console.log(`  OK  ${matchedRef} -> uploaded (${sizeKb} KB) — ${publicUrl}`)
      results.push({ status: 'uploaded', file, reference: matchedRef, sizeKb })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  ERROR  ${matchedRef} — ${message}`)
      results.push({ status: 'error', file, message })
    }
  }

  // 4. Summary
  const uploaded = results.filter(r => r.status === 'uploaded').length
  const dryRunCount = results.filter(r => r.status === 'skipped_dry_run').length
  const notFound = results.filter(r => r.status === 'not_found').length
  const tooLarge = results.filter(r => r.status === 'too_large').length
  const errors = results.filter(r => r.status === 'error').length

  console.log('')
  console.log('='.repeat(50))
  console.log('UPLOAD SUMMARY')
  console.log('='.repeat(50))
  if (dryRun) {
    console.log(`Would upload : ${dryRunCount}`)
  } else {
    console.log(`Uploaded     : ${uploaded}`)
    console.log(`Errors       : ${errors}`)
  }
  console.log(`Not found    : ${notFound}`)
  console.log(`Too large    : ${tooLarge}`)
  console.log(`Total files  : ${results.length}`)
  console.log('='.repeat(50))

  if (notFound > 0) {
    console.log('\nFiles with no matching product:')
    results
      .filter(r => r.status === 'not_found')
      .forEach(r => console.log(`  - ${r.file}`))
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
