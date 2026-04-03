import Link from 'next/link'
import Image from 'next/image'
import { CartButton } from '@/components/ui/cart-button'
import { SearchButton } from '@/components/layout/search-button'
import { MobileNav } from '@/components/layout/mobile-nav'
import { AccountLink } from '@/components/layout/account-link'
import { Phone, Mail, FileText, ChevronDown } from 'lucide-react'

export function Header() {
  return (
    <header className="w-full bg-white/95 backdrop-blur-md border-b border-border/50 shadow-sm sticky top-0 z-50">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded">
        Aller au contenu principal
      </a>
      {/* Top Bar — desktop only */}
      <div className="bg-primary text-primary-foreground text-xs py-2 hidden md:block">
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
              <Phone size={13} className="text-accent" /> 06 22 90 28 54
            </span>
            <span className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
              <Mail size={13} className="text-accent" /> societe@sapal.fr
            </span>
          </div>
          <Link href="/contact" className="hover:text-accent transition-colors flex items-center gap-1.5 cursor-pointer font-medium">
            <FileText size={13} /> Demander un devis sur mesure
          </Link>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4 sm:px-6 py-3 md:py-5">
        {/* Mobile: logo + cart + hamburger on one line */}
        <div className="flex items-center justify-between gap-3 md:hidden">
          <Link href="/" className="flex-shrink-0 transition-all hover:opacity-80 duration-300">
            <Image src="/logo.png" alt="SAPAL Signalisation" width={200} height={64} className="h-10 w-auto object-contain" priority />
          </Link>
          <div className="flex items-center gap-2">
            <CartButton />
            <MobileNav />
          </div>
        </div>

        {/* Mobile: search bar below logo row */}
        <div className="mt-3 md:hidden">
          <SearchButton />
        </div>

        {/* Desktop: original layout */}
        <div className="hidden md:flex items-center gap-8 justify-between">
          <Link href="/" className="flex-shrink-0 transition-all hover:opacity-80 hover:scale-[0.98] duration-300">
            <Image src="/logo.png" alt="SAPAL Signalisation" width={200} height={64} className="h-16 w-auto object-contain" priority />
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-3xl">
            <SearchButton />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="hidden lg:flex flex-col items-end mr-4">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Besoin d&apos;aide ?</span>
              <span className="text-sm font-bold text-foreground">06 22 90 28 54</span>
            </div>
            <CartButton />
            <AccountLink />
          </div>
        </div>
      </div>

      {/* Navigation — desktop only */}
      <div className="border-t border-border/40 bg-secondary/10 hidden md:block">
        <div className="container mx-auto px-4 sm:px-6">
          <nav aria-label="Navigation principale" className="flex items-center gap-0 text-[13px] xl:text-[14px] font-bold uppercase tracking-wide">
            <Link href="/catalogue" className="relative py-3.5 px-5 hover:text-accent transition-colors flex items-center gap-1 group">
              Tous nos produits
              <ChevronDown size={14} className="opacity-50 group-hover:opacity-100 transition-opacity" />
              <span className="absolute bottom-0 left-5 right-5 h-[2px] bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></span>
            </Link>
            <Link href="/catalogue/procity" className="relative py-3.5 px-5 text-muted-foreground hover:text-foreground transition-colors group">
              Catalogue ProCity
              <span className="absolute bottom-0 left-5 right-5 h-[2px] bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></span>
            </Link>
            <Link href="/catalogue/signalisation" className="relative py-3.5 px-5 text-muted-foreground hover:text-foreground transition-colors group">
              Signalisation
              <span className="absolute bottom-0 left-5 right-5 h-[2px] bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></span>
            </Link>
            <Link href="/catalogue/mobilier-urbain" className="relative py-3.5 px-5 text-muted-foreground hover:text-foreground transition-colors group">
              Mobilier Urbain
              <span className="absolute bottom-0 left-5 right-5 h-[2px] bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></span>
            </Link>
            <Link href="/catalogue/amenagement-securite" className="relative py-3.5 px-5 text-muted-foreground hover:text-foreground transition-colors group">
              Aménagement & Sécurité
              <span className="absolute bottom-0 left-5 right-5 h-[2px] bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></span>
            </Link>
            <div className="flex-1"></div>
            <Link href="/realisations" className="relative py-3.5 px-5 text-muted-foreground hover:text-foreground transition-colors group">
              Réalisations
              <span className="absolute bottom-0 left-5 right-5 h-[2px] bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
