import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Propositions visuelles — SAPAL",
  description: "Directions créatives pour la page d'accueil SAPAL.",
  robots: { index: false, follow: false },
};

export default function PropositionsLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen w-full bg-white text-neutral-900">{children}</div>;
}
