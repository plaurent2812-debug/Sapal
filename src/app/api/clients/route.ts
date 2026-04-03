import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Auth check: admin or gerant only
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const role = (user.user_metadata?.role as string) ?? 'client'
    if (role !== 'admin' && role !== 'gerant') {
      return Response.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const supabase = createServiceRoleClient()

    // Fetch all client profiles ordered by creation date
    const { data: profiles, error: profilesError } = await supabase
      .from('client_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('Error fetching client profiles:', profilesError)
      return Response.json({ error: 'Erreur lors de la récupération des profils' }, { status: 500 })
    }

    // Fetch all auth users to map emails
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('Error fetching auth users:', authError)
      return Response.json({ error: 'Erreur lors de la récupération des utilisateurs' }, { status: 500 })
    }

    const userMap = new Map(
      (authData?.users ?? []).map((u) => [u.id, u.email ?? 'N/A'])
    )

    // Merge profiles with emails
    const result = (profiles ?? []).map((p) => ({
      ...p,
      email: userMap.get(p.user_id) ?? 'N/A',
    }))

    return Response.json({ clients: result })
  } catch (error) {
    console.error('API Error:', error)
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
