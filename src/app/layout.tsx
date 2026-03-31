import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Outfit } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const dmSerif = DM_Serif_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
});

const outfit = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sapal-signaletique.fr";

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.json",
  title: {
    default: "SAPAL Signalisation | Expert en Mobilier Urbain & Signalétique",
    template: "%s | SAPAL Signalisation",
  },
  description:
    "SAPAL Signalisation, fournisseur B2B de mobilier urbain, signalétique et équipements d'espaces publics pour les collectivités françaises. Devis gratuit sous 3h.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SAPAL",
  },
  openGraph: {
    siteName: "SAPAL Signalisation",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${dmSerif.variable} ${outfit.variable} antialiased`}>
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <Header />
        <main id="main-content" className="flex-1 w-full">
          {children}
        </main>
        <Footer />
        <ServiceWorkerRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
