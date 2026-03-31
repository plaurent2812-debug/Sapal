import Link from 'next/link'
import Image from 'next/image'
import { Mail, Phone, MapPin, ArrowRight } from 'lucide-react'

export function Footer() {
  return (
    <footer className="relative overflow-hidden">
      {/* CTA Band */}
      <div className="bg-accent py-5">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-accent-foreground font-bold text-sm sm:text-base">
            Besoin d&apos;un devis personnalisé ? Réponse garantie en 24h.
          </p>
          <Link href="/contact" className="bg-white text-foreground hover:bg-white/90 transition-colors px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm">
            Nous contacter <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Main Footer */}
      <div className="bg-primary text-white pt-16 pb-8 relative">
        <div className="absolute inset-0 bg-grid opacity-[0.03]"></div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
            {/* Brand */}
            <div className="md:col-span-4">
              <Link href="/" className="inline-block mb-5">
                <Image src="/logo.png" alt="SAPAL Signalisation" width={225} height={72} className="h-[72px] w-auto object-contain brightness-0 invert" />
              </Link>
              <p className="text-white/50 text-sm leading-relaxed mb-6 max-w-xs">
                Expert en équipement et aménagement urbain pour les collectivités et entreprises depuis plus de 30 ans.
              </p>
              <div className="space-y-2.5">
                <a href="tel:0468000000" className="flex items-center gap-3 text-sm text-white/60 hover:text-accent transition-colors">
                  <Phone size={15} className="text-accent" /> 04 68 00 00 00
                </a>
                <a href="mailto:societe@sapal.fr" className="flex items-center gap-3 text-sm text-white/60 hover:text-accent transition-colors">
                  <Mail size={15} className="text-accent" /> societe@sapal.fr
                </a>
                <span className="flex items-center gap-3 text-sm text-white/60">
                  <MapPin size={15} className="text-accent" /> Perpignan, France
                </span>
              </div>
            </div>

            {/* Catalogue */}
            <nav aria-label="Catalogue" className="md:col-span-2">
              <h3 className="font-heading text-lg text-white mb-5">Catalogue</h3>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/catalogue/mobilier-urbain" className="text-white/50 hover:text-accent transition-colors">Mobilier Urbain</Link></li>
                <li><Link href="/catalogue/signalisation" className="text-white/50 hover:text-accent transition-colors">Signalisation</Link></li>
                <li><Link href="/catalogue/abris-et-cycles" className="text-white/50 hover:text-accent transition-colors">Abris et Cycles</Link></li>
                <li><Link href="/catalogue/amenagement-securite" className="text-white/50 hover:text-accent transition-colors">Aménagement Sécurité</Link></li>
              </ul>
            </nav>

            {/* Entreprise */}
            <nav aria-label="Entreprise" className="md:col-span-2">
              <h3 className="font-heading text-lg text-white mb-5">Entreprise</h3>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/qui-sommes-nous" className="text-white/50 hover:text-accent transition-colors">Qui sommes-nous</Link></li>
                <li><Link href="/realisations" className="text-white/50 hover:text-accent transition-colors">Réalisations</Link></li>
                <li><Link href="/contact" className="text-white/50 hover:text-accent transition-colors">Contact</Link></li>
                <li><Link href="/cgv" className="text-white/50 hover:text-accent transition-colors">Conditions de vente</Link></li>
              </ul>
            </nav>

            {/* Réassurance */}
            <div className="md:col-span-4">
              <h3 className="font-heading text-lg text-white mb-5">Pourquoi SAPAL ?</h3>
              <div className="space-y-3">
                {[
                  "Devis gratuit en 24h",
                  "Produits certifiés NF / CE",
                  "Livraison sur toute la France",
                  "Mandat administratif accepté",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"></div>
                    <span className="text-sm text-white/60">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-14 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/30">
              © {new Date().getFullYear()} SAPAL Signalisation. Tous droits réservés.
            </p>
            <div className="flex items-center gap-6 text-xs text-white/30">
              <Link href="/cgv" className="hover:text-white/60 transition-colors">CGV</Link>
              <Link href="/contact" className="hover:text-white/60 transition-colors">Mentions légales</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
