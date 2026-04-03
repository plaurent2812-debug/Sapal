'use client'

import { useState } from 'react'

export function useDownloadPDF() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function handleDownloadPDF(quoteId: string) {
    setDownloadingId(quoteId)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/pdf`)
      if (!res.ok) throw new Error('Erreur téléchargement')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'devis.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erreur lors du téléchargement du PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  return { downloadingId, handleDownloadPDF }
}
