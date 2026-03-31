/**
 * Script pour exécuter la migration SQL sur Supabase.
 *
 * Usage : node scripts/run-migration.mjs
 *
 * Alternative manuelle : copier le contenu de supabase/migrations/001_initial_schema.sql
 * dans l'éditeur SQL du dashboard Supabase (https://supabase.com/dashboard/project/dpycswobcixsowvxnvdc/sql)
 */

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql'), 'utf-8')

// Split SQL into individual statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Use the Supabase SQL endpoint (available via service role)
const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
  method: 'POST',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  },
})

console.log('Note: Supabase REST API ne supporte pas l\'exécution SQL directe.')
console.log('')
console.log('Pour appliquer la migration, copiez le SQL ci-dessous dans le dashboard Supabase :')
console.log(`  -> https://supabase.com/dashboard/project/dpycswobcixsowvxnvdc/sql`)
console.log('')
console.log('='.repeat(60))
console.log(sql)
console.log('='.repeat(60))
