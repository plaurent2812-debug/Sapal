// Synchronise les données prod -> Supabase local pour tester migrations sans risque.
// Usage: node scripts/sync_prod_to_local.mjs
import { createClient } from '@supabase/supabase-js'

const PROD_URL = process.env.PROD_SUPABASE_URL || 'https://dpycswobcixsowvxnvdc.supabase.co'
const PROD_KEY = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
const LOCAL_URL = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321'
const LOCAL_KEY = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY

if (!PROD_KEY || !LOCAL_KEY) {
  console.error('PROD_SUPABASE_SERVICE_ROLE_KEY et LOCAL_SUPABASE_SERVICE_ROLE_KEY requis')
  process.exit(1)
}

const prod = createClient(PROD_URL, PROD_KEY, { auth: { persistSession: false } })
const local = createClient(LOCAL_URL, LOCAL_KEY, { auth: { persistSession: false } })

const TABLES = [
  { name: 'suppliers', truncate: false },
  { name: 'categories', truncate: false },
  { name: 'products', truncate: false },
  { name: 'product_variants', truncate: false },
  { name: 'product_options', truncate: false },
]

async function fetchAll(client, table) {
  const all = []
  let from = 0
  const size = 1000
  while (true) {
    const { data, error } = await client.from(table).select('*').range(from, from + size - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < size) break
    from += size
  }
  return all
}

async function upsertBatched(client, table, rows) {
  const size = 500
  let written = 0
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size)
    const { error } = await client.from(table).upsert(batch, { onConflict: 'id' })
    if (error) {
      console.error(`  ERREUR sur batch ${i}-${i + size}: ${error.message}`)
      throw error
    }
    written += batch.length
    process.stdout.write(`\r  ${table}: ${written}/${rows.length}`)
  }
  process.stdout.write('\n')
}

for (const { name } of TABLES) {
  console.log(`\n→ ${name}`)
  const rows = await fetchAll(prod, name)
  console.log(`  prod: ${rows.length} rows`)
  if (rows.length === 0) continue
  await upsertBatched(local, name, rows)
}

console.log('\nSynchro terminée.')
