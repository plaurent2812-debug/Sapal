"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Phone, Mail, ChevronRight } from "lucide-react";

const NAV_LINKS = [
  { href: "/catalogue", label: "Tous nos produits" },
  { href: "/catalogue/signalisation", label: "Signalisation" },
  { href: "/catalogue/mobilier-urbain", label: "Mobilier Urbain" },
  { href: "/catalogue/amenagement-securite", label: "Aménagement & Sécurité" },
  { href: "/realisations", label: "Réalisations" },
  { href: "/contact", label: "Contact" },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <>
      {/* Hamburger button — visible on mobile only */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/50 text-foreground hover:bg-accent/10 hover:text-accent transition-colors cursor-pointer touch-manipulation"
        aria-label="Ouvrir le menu"
        aria-expanded={isOpen}
      >
        <Menu size={22} />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-[70] h-full w-[85vw] max-w-[360px] bg-white shadow-2xl transform transition-transform duration-300 ease-out md:hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <span className="font-heading text-lg text-foreground">Menu</span>
          <button
            onClick={() => setIsOpen(false)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary/50 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer touch-manipulation"
            aria-label="Fermer le menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav aria-label="Navigation mobile" className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl text-[15px] font-semibold text-foreground hover:bg-accent/10 hover:text-accent transition-colors touch-manipulation"
                >
                  {link.label}
                  <ChevronRight size={16} className="text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Devis CTA */}
          <div className="px-5 mt-6">
            <Link
              href="/contact"
              onClick={() => setIsOpen(false)}
              className="btn-fill block w-full text-center bg-accent text-accent-foreground hover:bg-accent/90 transition-all px-6 py-3.5 font-bold rounded-xl shadow-lg shadow-accent/20 touch-manipulation"
            >
              Demander un devis
            </Link>
          </div>

          {/* Contact info */}
          <div className="px-5 mt-8 space-y-3">
            <a
              href="tel:0468000000"
              className="flex items-center gap-3 text-sm text-muted-foreground hover:text-accent transition-colors touch-manipulation py-1"
            >
              <Phone size={16} className="text-accent flex-shrink-0" />
              04 68 00 00 00
            </a>
            <a
              href="mailto:contact@sapal-signalisation.com"
              className="flex items-center gap-3 text-sm text-muted-foreground hover:text-accent transition-colors touch-manipulation py-1"
            >
              <Mail size={16} className="text-accent flex-shrink-0" />
              contact@sapal-signalisation.com
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}
