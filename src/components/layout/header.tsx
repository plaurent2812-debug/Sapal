import Link from 'next/link'
import { CartButton } from '@/components/ui/cart-button'
import { SearchButton } from '@/components/layout/search-button'
import { MobileNav } from '@/components/layout/mobile-nav'
import { AccountLink } from '@/components/layout/account-link'
import { CatalogueDropdown } from '@/components/layout/catalogue-dropdown'
import { EditModeToggle } from '@/components/edit-mode/EditModeToggle'

// Catalogue est géré séparément via CatalogueDropdown (menu déroulant)
const NAV_ITEMS = [
  { href: '/catalogue', label: 'Solutions' },
  { href: '/qui-sommes-nous', label: 'Entreprise' },
  { href: '/contact', label: 'Contact' },
]

export function Header() {
  return (
    <header className="w-full bg-background border-b border-border sticky top-0 z-50">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded">
        Aller au contenu principal
      </a>

      <div className="mx-auto max-w-[1600px] px-4 md:px-8 lg:px-12">

        {/* Mobile : logo + actions */}
        <div className="flex items-center justify-between gap-3 md:hidden py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-md flex items-center justify-center">
              <span className="font-heading text-primary-foreground text-lg leading-none">S</span>
            </div>
            <div className="leading-tight">
              <div className="font-heading text-lg text-primary">Sapal</div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-foreground/60 font-medium">
                Mobilier urbain
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <EditModeToggle />
            <CartButton />
            <MobileNav />
          </div>
        </div>
        <div className="md:hidden pb-3">
          <SearchButton />
        </div>

        {/* Desktop : logo + nav + actions */}
        <div className="hidden md:flex items-center gap-8 py-4">
          <Link href="/" className="flex items-center gap-3 flex-shrink-0 group">
            <div className="leading-tight">
              <div className="font-heading text-3xl text-primary tracking-tight">Sapal</div>
            </div>
          </Link>

          <nav aria-label="Navigation principale" className="flex items-center gap-1 flex-1 justify-center">
            <CatalogueDropdown />
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-3 py-2 rounded-md hover:bg-white"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            <EditModeToggle />
            <CartButton />
            <AccountLink />
          </div>
        </div>

        {/* Barre de recherche — 2ème ligne sous la nav (desktop).
            Alignée sur le même centre que la nav (entre logo et actions droites). */}
        <div className="hidden md:flex items-center gap-8 pb-4">
          {/* Spacer invisible — même largeur que le logo */}
          <div className="flex-shrink-0 invisible" aria-hidden="true">
            <div className="flex items-center gap-3">
              <div className="leading-tight">
                <div className="font-heading text-3xl tracking-tight">Sapal</div>
              </div>
            </div>
          </div>

          {/* Zone de recherche, partage le flex-1 avec la nav au-dessus */}
          <div className="flex-1 flex justify-center">
            <div className="w-full max-w-2xl">
              <SearchButton />
            </div>
          </div>

          {/* Spacer invisible — même largeur que CartButton + AccountLink */}
          <div className="flex-shrink-0 invisible" aria-hidden="true">
            <div className="flex items-center gap-2">
              <CartButton />
              <AccountLink />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
