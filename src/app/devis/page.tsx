import type { Metadata } from "next";
import DevisPageClient from "./devis-page-client";

export const metadata: Metadata = {
  title: "Demande de devis",
  description:
    "Demandez un devis gratuit pour du mobilier urbain, de la signalétique ou des équipements d'espaces publics. Réponse sous 3h par SAPAL Signalisation.",
  alternates: { canonical: "/devis" },
};

export default function DevisPage() {
  return <DevisPageClient />;
}
