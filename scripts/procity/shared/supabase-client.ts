import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Retourne un client Supabase utilisant le service_role key pour les scripts d'import.
 *
 * Tous les scripts Procity tournent localement sur la prod (pas de DEV séparé — les branches
 * Supabase ne supportent pas le schéma historique). Chaque opération risquée doit donc être
 * précédée d'un dry-run et les imports massifs sont limités via --limit jusqu'à validation.
 *
 * Variables requises dans .env.local :
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
export function getProcitySupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  const projectRef = url.replace(/^https?:\/\//, '').split('.')[0];
  console.log(`[supabase] target=${projectRef} (service_role)`);

  return createClient(url, key, { auth: { persistSession: false } });
}
