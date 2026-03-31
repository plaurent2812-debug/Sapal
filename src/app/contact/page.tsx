import type { Metadata } from "next";
import ContactPageClient from "./contact-page-client";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contactez SAPAL Signalisation pour vos projets de mobilier urbain, signalétique et aménagement d'espaces publics. Réponse rapide garantie.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <ContactPageClient />;
}
