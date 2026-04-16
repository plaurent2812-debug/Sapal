'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

export function useAdminRole() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = user?.user_metadata?.role
      setIsAdmin(role === 'admin')
      setLoading(false)
    })
  }, [])

  return { isAdmin, loading }
}
