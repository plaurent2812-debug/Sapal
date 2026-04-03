'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { User } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

type UserRole = 'admin' | 'gerant' | 'client' | null

export function AccountLink() {
  const [role, setRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserClient()

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const userRole = (session?.user?.user_metadata?.role as UserRole) ?? null
      setRole(userRole)
      setLoading(false)
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const userRole = (session?.user?.user_metadata?.role as UserRole) ?? null
      setRole(userRole)
    })

    return () => subscription.unsubscribe()
  }, [])

  const href =
    role === 'admin' || role === 'gerant'
      ? '/admin'
      : role === 'client'
      ? '/mon-compte'
      : '/connexion'

  const label =
    role === 'admin' || role === 'gerant'
      ? 'Administration'
      : role === 'client'
      ? 'Mon compte'
      : 'Se connecter'

  if (loading) {
    return (
      <div className="hidden sm:flex flex-col items-center justify-center ml-2 w-[52px]">
        <div className="w-10 h-10 rounded-xl bg-secondary/50 animate-pulse" />
        <div className="h-2 w-8 bg-muted rounded mt-1 animate-pulse" />
      </div>
    )
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="hidden sm:flex flex-col items-center justify-center text-muted-foreground hover:text-accent transition-colors cursor-pointer ml-2 group"
    >
      <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center group-hover:bg-accent/10 transition-colors duration-300">
        <User size={20} />
      </div>
      <span className="text-[9px] uppercase font-bold tracking-wider mt-1 whitespace-nowrap">
        {role === 'admin' || role === 'gerant' ? 'Admin' : role === 'client' ? 'Compte' : 'Connexion'}
      </span>
    </Link>
  )
}
