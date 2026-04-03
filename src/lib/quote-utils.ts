export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  sent: { label: 'Envoye', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  accepted: { label: 'Accepte', className: 'bg-green-100 text-green-800 border-green-200' },
  rejected: { label: 'Refuse', className: 'bg-red-100 text-red-800 border-red-200' },
}

export function formatDate(dateStr: string, options?: { withTime?: boolean }): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }
  if (options?.withTime) {
    opts.hour = '2-digit'
    opts.minute = '2-digit'
  }
  return new Date(dateStr).toLocaleDateString('fr-FR', opts)
}
