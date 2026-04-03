'use client'

import { useState, useEffect } from 'react'
import { Building2, Calendar, CheckCircle, Clock, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

type AccountStatus = 'pending' | 'active'
type ClientType = 'B2B' | 'B2C' | 'collectivite'
type FilterTab = 'pending' | 'active' | 'all'

interface ClientProfile {
  user_id: string
  company_name: string | null
  siret: string | null
  client_type: ClientType
  account_status: AccountStatus
  created_at: string
  email: string
}

const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  B2B: 'B2B',
  B2C: 'B2C',
  collectivite: 'Collectivité',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('pending')
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchClients()
  }, [])

  async function fetchClients() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/clients')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur lors de la récupération des clients')
      }
      const data = await res.json()
      setClients(data.clients ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur serveur')
    } finally {
      setLoading(false)
    }
  }

  async function handleActivate(userId: string) {
    setActivatingId(userId)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${userId}/activate`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur lors de l\'activation')
      }
      setClients((prev) =>
        prev.map((c) =>
          c.user_id === userId ? { ...c, account_status: 'active' } : c
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'activation')
    } finally {
      setActivatingId(null)
    }
  }

  const filteredClients = clients.filter((c) => {
    if (activeTab === 'pending') return c.account_status === 'pending'
    if (activeTab === 'active') return c.account_status === 'active'
    return true
  })

  const pendingCount = clients.filter((c) => c.account_status === 'pending').length
  const activeCount = clients.filter((c) => c.account_status === 'active').length

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'pending', label: 'En attente', count: pendingCount },
    { key: 'active', label: 'Actifs', count: activeCount },
    { key: 'all', label: 'Tous', count: clients.length },
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Gestion des clients</h1>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[20px] ${
                  activeTab === tab.key
                    ? tab.key === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" />
          Chargement...
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users size={32} className="mx-auto mb-2 opacity-40" />
          {activeTab === 'pending'
            ? 'Aucun compte en attente de validation.'
            : activeTab === 'active'
            ? 'Aucun compte actif.'
            : 'Aucun client enregistré.'}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {filteredClients.length} client{filteredClients.length > 1 ? 's' : ''}
          </p>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold">Entreprise</th>
                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">SIRET</th>
                    <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Type</th>
                    <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Inscription</th>
                    <th className="text-center px-4 py-3 font-semibold w-36">Statut / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr
                      key={client.user_id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">
                            {client.company_name ?? <span className="text-muted-foreground italic">Non renseigné</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <a
                          href={`mailto:${client.email}`}
                          className="text-primary hover:underline text-xs"
                        >
                          {client.email}
                        </a>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground font-mono text-xs">
                        {client.siret ?? '—'}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                          {CLIENT_TYPE_LABEL[client.client_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} />
                          {formatDate(client.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {client.account_status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                            <CheckCircle size={12} />
                            Actif
                          </span>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium mb-1">
                              <Clock size={11} />
                              En attente
                            </span>
                            <Button
                              size="sm"
                              disabled={activatingId === client.user_id}
                              onClick={() => handleActivate(client.user_id)}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-3"
                            >
                              {activatingId === client.user_id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                'Valider'
                              )}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
