'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Building2, AlertCircle } from 'lucide-react'

type ClientType = 'B2B' | 'B2C' | 'Collectivité'

interface FormState {
  email: string
  password: string
  confirmPassword: string
  company_name: string
  siret: string
  tva_intracom: string
  client_type: ClientType
  address: string
  postal_code: string
  city: string
  phone: string
}

const initialForm: FormState = {
  email: '',
  password: '',
  confirmPassword: '',
  company_name: '',
  siret: '',
  tva_intracom: '',
  client_type: 'B2B',
  address: '',
  postal_code: '',
  city: '',
  phone: '',
}

export default function InscriptionPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(initialForm)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const validate = (): string | null => {
    if (form.password.length < 8) {
      return 'Le mot de passe doit contenir au moins 8 caractères.'
    }
    if (form.password !== form.confirmPassword) {
      return 'Les mots de passe ne correspondent pas.'
    }
    if (!/^\d{14}$/.test(form.siret)) {
      return 'Le numéro SIRET doit contenir exactement 14 chiffres.'
    }
    if (form.tva_intracom && !/^FR\d{11}$/.test(form.tva_intracom)) {
      return 'Le numéro de TVA intracommunautaire doit suivre le format FR suivi de 11 chiffres.'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          company_name: form.company_name,
          siret: form.siret,
          tva_intracom: form.tva_intracom || undefined,
          client_type: form.client_type,
          address: form.address || undefined,
          postal_code: form.postal_code || undefined,
          city: form.city || undefined,
          phone: form.phone || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue lors de l'inscription.")
        return
      }

      router.push('/compte-en-attente')
    } catch {
      setError('Impossible de contacter le serveur. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'flex w-full rounded-xl border border-border/80 bg-muted/20 px-4 py-2.5 h-11 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:bg-background transition-all'

  const labelClass = 'block text-sm font-semibold mb-1.5'

  return (
    <div className="min-h-screen flex items-start justify-center bg-secondary/30 px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg">
        {/* Header card */}
        <div className="bg-card rounded-xl border border-border/60 shadow-xl shadow-black/5 px-5 py-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
              <UserPlus size={24} className="text-primary-foreground" />
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl tracking-tight">Créer un compte</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Accédez au catalogue professionnel SAPAL Signalisation.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm flex items-start gap-3"
            >
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Section : Identifiants */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Identifiants de connexion
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className={labelClass}>
                    Adresse email <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="contact@entreprise.fr"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className={labelClass}>
                      Mot de passe <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      autoComplete="new-password"
                      value={form.password}
                      onChange={set('password')}
                      placeholder="8 caractères minimum"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className={labelClass}>
                      Confirmation <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      required
                      autoComplete="new-password"
                      value={form.confirmPassword}
                      onChange={set('confirmPassword')}
                      placeholder="Répétez le mot de passe"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section : Entreprise */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Building2 size={13} />
                Informations entreprise
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="company_name" className={labelClass}>
                    Raison sociale <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="company_name"
                    type="text"
                    required
                    autoComplete="organization"
                    value={form.company_name}
                    onChange={set('company_name')}
                    placeholder="Nom de votre entreprise"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="siret" className={labelClass}>
                      Numéro SIRET <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="siret"
                      type="text"
                      required
                      inputMode="numeric"
                      maxLength={14}
                      value={form.siret}
                      onChange={set('siret')}
                      placeholder="14 chiffres"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="tva_intracom" className={labelClass}>
                      TVA intracommunautaire
                    </label>
                    <input
                      id="tva_intracom"
                      type="text"
                      value={form.tva_intracom}
                      onChange={set('tva_intracom')}
                      placeholder="FR + 11 chiffres"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="client_type" className={labelClass}>
                    Type de client <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="client_type"
                    required
                    value={form.client_type}
                    onChange={set('client_type')}
                    className={inputClass}
                  >
                    <option value="B2B">B2B — Entreprise privée</option>
                    <option value="B2C">B2C — Particulier</option>
                    <option value="Collectivité">Collectivité — Organisme public</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section : Coordonnées (optionnel) */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Coordonnées <span className="font-normal normal-case">(optionnel)</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="address" className={labelClass}>
                    Adresse
                  </label>
                  <input
                    id="address"
                    type="text"
                    autoComplete="street-address"
                    value={form.address}
                    onChange={set('address')}
                    placeholder="Numéro et nom de rue"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="postal_code" className={labelClass}>
                      Code postal
                    </label>
                    <input
                      id="postal_code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={5}
                      value={form.postal_code}
                      onChange={set('postal_code')}
                      placeholder="06000"
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="city" className={labelClass}>
                      Ville
                    </label>
                    <input
                      id="city"
                      type="text"
                      autoComplete="address-level2"
                      value={form.city}
                      onChange={set('city')}
                      placeholder="Cannes"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className={labelClass}>
                    Téléphone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="01 23 45 67 89"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-bold text-base bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  Création du compte...
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Créer mon compte
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Déjà un compte ?{' '}
            <Link
              href="/connexion"
              className="font-semibold text-primary hover:underline underline-offset-4"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
