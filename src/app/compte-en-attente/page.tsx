import Link from 'next/link'
import { Clock, ArrowLeft, MailCheck } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Compte en attente de validation',
  robots: { index: false, follow: false },
}

export default function CompteEnAttentePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4 py-12">
      <div className="w-full max-w-md bg-card rounded-xl border border-border/60 shadow-xl shadow-black/5 p-8 text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-50 border-2 border-amber-200/80 mb-6">
          <Clock size={36} className="text-amber-500" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h1 className="font-heading text-2xl tracking-tight mb-3">
          Compte en attente de validation
        </h1>

        {/* Body text */}
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          Votre compte a été créé avec succès. Notre équipe va vérifier vos informations et activer
          votre accès sous 24h. Vous recevrez un email de confirmation dès l&apos;activation.
        </p>

        {/* Email reminder */}
        <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-border/50 text-left mb-8">
          <MailCheck size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pensez à vérifier vos courriers indésirables si vous ne recevez pas notre email dans
            les 24h.
          </p>
        </div>

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline underline-offset-4"
        >
          <ArrowLeft size={16} />
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  )
}
