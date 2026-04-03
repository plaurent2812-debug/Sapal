'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'
import { Pencil } from 'lucide-react'

export function AdminEditButton({ productId }: { productId: string }) {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      const role = session?.user?.user_metadata?.role
      if (role === 'admin' || role === 'gerant') {
        setIsAdmin(true)
      }
    })
  }, [])

  if (!isAdmin) return null

  return (
    <Link
      href={`/admin/produits/${productId}`}
      className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity text-sm font-medium"
    >
      <Pencil size={16} />
      Modifier ce produit
    </Link>
  )
}
