"use client"
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useQuoteStore } from '@/store/useQuoteStore'
import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'

export function CartButton() {
  const items = useQuoteStore(state => state.items)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const totalItems = mounted ? items.reduce((sum, item) => sum + item.quantity, 0) : 0

  return (
    <Link href="/devis" className="relative inline-flex" aria-label={totalItems > 0 ? `Mon Devis (${totalItems} article${totalItems > 1 ? 's' : ''})` : 'Mon Devis'}>
      <Button variant="default" className="cursor-pointer gap-2 font-semibold" tabIndex={-1} aria-hidden="true">
        <FileText size={18} />
        Mon Devis
      </Button>
      {totalItems > 0 && (
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-background animate-in zoom-in-50 duration-300" aria-hidden="true">
          {totalItems}
        </span>
      )}
    </Link>
  )
}

