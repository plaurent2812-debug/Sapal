/**
 * audit-images.ts
 *
 * Audits all products in the database and reports which ones are missing
 * real images (NULL, empty, or placeholder URLs).
 *
 * Output: scripts/output/image-audit.csv
 * Usage: npx tsx scripts/audit-images.ts
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local manually (no dotenv dependency needed)
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

type ImageStatus = 'MISSING' | 'PLACEHOLDER' | 'HAS_IMAGE'

interface ProductAuditRow {
  id: string
  reference: string
  name: string
  category: string
  image_url: string
  status: ImageStatus
}

function classifyImage(imageUrl: string | null | undefined): ImageStatus {
  if (!imageUrl || imageUrl.trim() === '') return 'MISSING'
  const lower = imageUrl.toLowerCase()
  if (
    lower.includes('placeholder') ||
    lower.includes('no-image') ||
    lower.includes('noimage') ||
    lower.includes('default-image') ||
    lower.includes('dummy') ||
    lower.includes('lorem')
  ) {
    return 'PLACEHOLDER'
  }
  return 'HAS_IMAGE'
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

async function main() {
  console.log('Fetching products from Supabase...')

  const { data: products, error } = await supabase
    .from('products')
    .select('id, reference, name, image_url, category_id, categories(name)')
    .order('name', { ascending: true })

  if (error) {
    console.error('Supabase query error:', error.message)
    process.exit(1)
  }

  if (!products || products.length === 0) {
    console.log('No products found.')
    process.exit(0)
  }

  type ProductRow = {
    id?: string
    reference?: string
    name?: string
    image_url?: string | null
    categories?: { name?: string } | Array<{ name?: string }> | null
  }

  const rows: ProductAuditRow[] = (products as ProductRow[]).map((p) => {
    const categoryName =
      p.categories && typeof p.categories === 'object' && !Array.isArray(p.categories)
        ? p.categories.name ?? ''
        : Array.isArray(p.categories) && p.categories.length > 0
          ? p.categories[0].name ?? ''
          : ''

    return {
      id: p.id ?? '',
      reference: p.reference ?? '',
      name: p.name ?? '',
      category: categoryName,
      image_url: p.image_url ?? '',
      status: classifyImage(p.image_url),
    }
  })

  // Stats
  const total = rows.length
  const missing = rows.filter(r => r.status === 'MISSING').length
  const placeholder = rows.filter(r => r.status === 'PLACEHOLDER').length
  const hasImage = rows.filter(r => r.status === 'HAS_IMAGE').length
  const needsImage = missing + placeholder

  // Write CSV
  const outputDir = join(__dirname, 'output')
  mkdirSync(outputDir, { recursive: true })
  const outputPath = join(outputDir, 'image-audit.csv')

  const header = 'id,reference,name,category,image_url,status'
  const csvLines = rows.map(r =>
    [
      escapeCsv(r.id),
      escapeCsv(r.reference),
      escapeCsv(r.name),
      escapeCsv(r.category),
      escapeCsv(r.image_url),
      r.status,
    ].join(',')
  )

  writeFileSync(outputPath, [header, ...csvLines].join('\n'), 'utf-8')

  // Console summary
  console.log('')
  console.log('='.repeat(50))
  console.log('IMAGE AUDIT SUMMARY')
  console.log('='.repeat(50))
  console.log(`Total products   : ${total}`)
  console.log(`With image       : ${hasImage}`)
  console.log(`Missing (null)   : ${missing}`)
  console.log(`Placeholder      : ${placeholder}`)
  console.log(`Needs image      : ${needsImage} (${Math.round((needsImage / total) * 100)}%)`)
  console.log('='.repeat(50))
  console.log(`CSV written to   : ${outputPath}`)
  console.log('')

  if (needsImage > 0) {
    console.log('Products needing images:')
    rows
      .filter(r => r.status !== 'HAS_IMAGE')
      .forEach(r => {
        console.log(`  [${r.status}] ${r.reference || r.id} — ${r.name} (${r.category || 'no category'})`)
      })
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
