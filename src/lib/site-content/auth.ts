import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Vérifie qu'un admin connecté effectue la requête.
 * Retourne le user ou une Response d'erreur à renvoyer directement.
 */
export async function requireAdmin(): Promise<
  | { user: { id: string }; error: null }
  | { user: null; error: Response }
> {
  const authClient = await createServerSupabaseClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    return {
      user: null,
      error: Response.json({ error: 'Non autorisé' }, { status: 401 }),
    }
  }

  const role = (user.user_metadata?.role as string | undefined) ?? 'client'
  if (role !== 'admin') {
    return {
      user: null,
      error: Response.json({ error: 'Accès refusé' }, { status: 403 }),
    }
  }

  return { user: { id: user.id }, error: null }
}
