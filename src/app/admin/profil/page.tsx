'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Building2,
  Hash,
  MapPin,
  Phone,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Mail,
} from 'lucide-react'
import type { ClientProfile } from '@/lib/supabase/types'

type ClientType = 'B2B' | 'B2C' | 'collectivite'

interface FormData {
  company_name: string
  siret: string
  tva_intracom: string
  address: string
  postal_code: string
  city: string
  phone: string
  client_type: ClientType
}

const initialForm: FormData = {
  company_name: '',
  siret: '',
  tva_intracom: '',
  address: '',
  postal_code: '',
  city: '',
  phone: '',
  client_type: 'B2B',
}

function validateSiret(value: string): string | null {
  if (!value) return null
  if (!/^\d{14}$/.test(value)) return 'Le SIRET doit contenir exactement 14 chiffres'
  return null
}

function validateTvaIntracom(value: string): string | null {
  if (!value) return null
  if (!/^FR\d{11}$/.test(value)) return 'Le format attendu est FR + 11 chiffres (ex: FR12345678901)'
  return null
}

export default function ProfilPage() {
  const [form, setForm] = useState<FormData>(initialForm)
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadProfile() {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setLoading(false)
        return
      }

      setEmail(session.user.email ?? '')
      setUserId(session.user.id)

      const { data } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (data) {
        const profile = data as ClientProfile
        setForm({
          company_name: profile.company_name ?? '',
          siret: profile.siret ?? '',
          tva_intracom: profile.tva_intracom ?? '',
          address: profile.address ?? '',
          postal_code: profile.postal_code ?? '',
          city: profile.city ?? '',
          phone: profile.phone ?? '',
          client_type: profile.client_type,
        })
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validate
    const errors: Record<string, string> = {}
    const siretErr = validateSiret(form.siret)
    if (siretErr) errors.siret = siretErr
    const tvaErr = validateTvaIntracom(form.tva_intracom)
    if (tvaErr) errors.tva_intracom = tvaErr

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    if (!userId) {
      setError('Session expir\u00e9e. Veuillez vous reconnecter.')
      return
    }

    setSaving(true)

    const supabase = createBrowserClient()

    const payload = {
      user_id: userId,
      company_name: form.company_name.trim() || null,
      siret: form.siret.trim() || null,
      tva_intracom: form.tva_intracom.trim() || null,
      address: form.address.trim() || null,
      postal_code: form.postal_code.trim() || null,
      city: form.city.trim() || null,
      phone: form.phone.trim() || null,
      client_type: form.client_type,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from('client_profiles')
      .upsert(payload, { onConflict: 'user_id' })

    if (upsertError) {
      setError(upsertError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setSuccess(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-3xl tracking-tight">Mon Profil</h1>
        <div className="bg-card rounded-xl border border-border/60 p-8 animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl tracking-tight">Mon Profil</h1>

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          <CheckCircle size={16} />
          Profil enregistr&eacute; avec succ&egrave;s.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-card rounded-xl border border-border/60 shadow-sm p-6 space-y-6">
          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Mail size={14} />
              Email
            </label>
            <Input value={email} disabled className="bg-muted/30" />
            <p className="text-xs text-muted-foreground">
              L&apos;email est li&eacute; &agrave; votre compte et ne peut pas &ecirc;tre modifi&eacute; ici.
            </p>
          </div>

          {/* Client type */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Building2 size={14} />
              Type de client
            </label>
            <select
              value={form.client_type}
              onChange={(e) => handleChange('client_type', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            >
              <option value="B2B">B2B - Entreprise</option>
              <option value="B2C">B2C - Particulier</option>
              <option value="collectivite">Collectivit&eacute;</option>
            </select>
          </div>

          {/* Company name */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Building2 size={14} />
              Raison sociale
            </label>
            <Input
              value={form.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder="Ex: SAPAL SAS"
            />
          </div>

          {/* SIRET & TVA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Hash size={14} />
                SIRET
              </label>
              <Input
                value={form.siret}
                onChange={(e) => handleChange('siret', e.target.value.replace(/\D/g, '').slice(0, 14))}
                placeholder="12345678901234"
                maxLength={14}
              />
              {fieldErrors.siret && (
                <p className="text-xs text-destructive">{fieldErrors.siret}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Hash size={14} />
                TVA Intracommunautaire
              </label>
              <Input
                value={form.tva_intracom}
                onChange={(e) => handleChange('tva_intracom', e.target.value.toUpperCase().slice(0, 15))}
                placeholder="FR12345678901"
                maxLength={15}
              />
              {fieldErrors.tva_intracom && (
                <p className="text-xs text-destructive">{fieldErrors.tva_intracom}</p>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold flex items-center gap-2">
              <MapPin size={14} />
              Adresse
            </label>
            <Input
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="12 rue de la Mairie"
            />
          </div>

          {/* Postal code & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-2">
                <MapPin size={14} />
                Code postal
              </label>
              <Input
                value={form.postal_code}
                onChange={(e) => handleChange('postal_code', e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="66000"
                maxLength={5}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-2">
                <MapPin size={14} />
                Ville
              </label>
              <Input
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="Perpignan"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Phone size={14} />
              T&eacute;l&eacute;phone
            </label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="04 68 00 00 00"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-6">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
