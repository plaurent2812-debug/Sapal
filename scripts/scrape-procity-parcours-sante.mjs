#!/usr/bin/env node
// Scrape Procity product pages to enrich product.specifications.
// Safe to re-run — only merges new keys.
// Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/scrape-procity-parcours-sante.mjs [--dry-run] [-v]

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

// Manual overrides for products whose SAPAL slug doesn't match the Procity URL.
const SLUG_OVERRIDES = {
  '820011': 'barres-fixes-3-barres', // Barres fixes (3 barres)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

const entities = {
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  aacute: 'á', agrave: 'à', acirc: 'â', auml: 'ä', atilde: 'ã',
  iacute: 'í', igrave: 'ì', icirc: 'î', iuml: 'ï',
  oacute: 'ó', ograve: 'ò', ocirc: 'ô', ouml: 'ö', otilde: 'õ',
  uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  ccedil: 'ç', ntilde: 'ñ',
  Eacute: 'É', Egrave: 'È', Ecirc: 'Ê',
  Aacute: 'Á', Agrave: 'À', Acirc: 'Â',
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d',
  ndash: '\u2013', mdash: '\u2014', hellip: '\u2026',
}
function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, e) => entities[e] ?? m)
}
function cleanText(str) {
  return decodeEntities(str).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}
function extractSpecs(html) {
  const re = /<div\s+class="para2-b[^"]*">\s*([\s\S]*?)\s*<\/div>\s*<div\s+class="para2-r[^"]*">\s*([\s\S]*?)\s*<\/div>/g
  const out = {}
  let m
  while ((m = re.exec(html))) {
    const key = cleanText(m[1])
    const value = cleanText(m[2])
    if (key && value) out[key] = value
  }
  return out
}
async function tryFetch(slug, reference) {
  const candidates = [
    SLUG_OVERRIDES[reference] && `https://www.procity.eu/fr/${SLUG_OVERRIDES[reference]}.html`,
    `https://www.procity.eu/fr/${slug}.html`,
    `https://www.procity.eu/fr/${slug.replace(/-d-/g, '-d')}.html`,
  ].filter(Boolean)
  for (const url of candidates) {
    try {
      const r = await fetch(url, { redirect: 'follow' })
      if (r.ok) {
        const html = await r.text()
        if (html.includes('para2-b') && html.includes('para2-r')) return { url, html }
      }
    } catch {}
  }
  return null
}

async function main() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, slug, reference, specifications, category_id, categories!inner(name)')
    .ilike('categories.name', '%parcours de sant%')
    .order('reference')
  if (error) { console.error('Query error:', error); process.exit(1) }

  console.log(`Found ${products.length} products in "Parcours de santé"`)
  console.log(DRY_RUN ? '(DRY RUN — no writes)' : '(WRITING to DB)')
  console.log()

  let ok = 0, skipped = 0, failed = 0
  const failedList = []

  for (const p of products) {
    process.stdout.write(`[${p.reference}] ${p.name.padEnd(40).slice(0, 40)} ... `)
    const result = await tryFetch(p.slug, p.reference)
    if (!result) { console.log('❌ page not found'); failed++; failedList.push(p); continue }
    const specs = extractSpecs(result.html)
    if (Object.keys(specs).length === 0) { console.log('⚠️  no specs found'); skipped++; continue }
    const merged = { ...(p.specifications || {}), ...specs }
    const added = Object.keys(specs).filter(k => !(p.specifications || {})[k])
    console.log(`✅ ${Object.keys(specs).length} specs (${added.length} new)`)
    if (VERBOSE) for (const [k, v] of Object.entries(specs)) console.log(`    ${k}: ${v}`)
    if (!DRY_RUN) {
      const { error: updErr } = await supabase.from('products').update({ specifications: merged }).eq('id', p.id)
      if (updErr) { console.log(`    ⚠️  update error: ${updErr.message}`); failed++; continue }
    }
    ok++
  }

  console.log()
  console.log(`Done: ${ok} updated, ${skipped} skipped, ${failed} failed`)
  if (failedList.length) {
    console.log('Failed (to fix manually in edit mode):')
    for (const p of failedList) console.log(`  - ${p.reference}  ${p.name}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
