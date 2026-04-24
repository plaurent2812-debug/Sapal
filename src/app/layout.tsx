import type { Metadata, Viewport } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { GlobalStructuredData } from "@/components/seo/structured-data";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sapal.fr";

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.json",
  title: {
    default: "SAPAL Signalisation | Mobilier urbain & signalétique — Livraison France",
    template: "%s | SAPAL Signalisation",
  },
  description:
    "SAPAL Signalisation, fournisseur B2B de mobilier urbain, signalétique routière et équipements d'espaces publics. Basés à Cannes, nous livrons et accompagnons les collectivités partout en France métropolitaine. Devis gratuit sous 3h.",
  keywords: [
    "mobilier urbain",
    "signalisation routière",
    "panneaux de signalisation",
    "barrière ville",
    "aire de jeux collectivité",
    "fournisseur collectivités",
    "Cannes",
    "PACA",
    "France",
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SAPAL",
  },
  openGraph: {
    siteName: "SAPAL Signalisation",
    locale: "fr_FR",
    type: "website",
    url: siteUrl,
    title: "SAPAL Signalisation | Mobilier urbain & signalétique — Livraison France",
    description:
      "Fournisseur B2B de mobilier urbain, signalétique et équipements publics. Basés à Cannes, livraison partout en France métropolitaine.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SAPAL Signalisation | Mobilier urbain & signalétique",
    description:
      "Fournisseur B2B de mobilier urbain, signalétique et équipements publics. Basés à Cannes, livraison partout en France.",
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${spaceGrotesk.variable} ${dmSans.variable} antialiased`}>
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <Header />
        <main id="main-content" className="flex-1 w-full">
          {children}
        </main>
        <Footer />
        <GlobalStructuredData />
        <ServiceWorkerRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
