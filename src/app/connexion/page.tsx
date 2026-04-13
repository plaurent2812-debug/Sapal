'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogIn, AlertCircle, ArrowLeft } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

export default function ConnexionPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createBrowserClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !data.session) {
      setError('Identifiants incorrects. Vérifiez votre email et votre mot de passe.')
      setLoading(false)
      return
    }

    const role = data.session.user.user_metadata?.role as string | undefined

    if (role === 'admin') {
      router.push('/admin')
    } else if (role === 'gerant') {
      router.push('/gerant/dashboard')
    } else {
      router.push('/mon-compte')
    }
  }

  const inputClass =
    'flex w-full rounded-xl border border-border/80 bg-muted/20 px-4 h-11 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:bg-background transition-all'

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft size={16} />
          Retour au site
        </Link>
      <div className="bg-card rounded-xl border border-border/60 shadow-xl shadow-black/5 px-5 py-6 sm:px-8 sm:py-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <LogIn size={24} className="text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl tracking-tight">Connexion</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Accédez à votre espace client SAPAL Signalisation.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-semibold">
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@entreprise.fr"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-semibold">
                Mot de passe
              </label>
              <span className="text-xs text-muted-foreground cursor-default select-none">
                Mot de passe oublié ?
              </span>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl font-bold text-base bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                Connexion...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Se connecter
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Pas encore de compte ?{' '}
          <Link
            href="/inscription"
            className="font-semibold text-primary hover:underline underline-offset-4"
          >
            S&apos;inscrire
          </Link>
        </p>
      </div>
      </div>
    </div>
  )
}
