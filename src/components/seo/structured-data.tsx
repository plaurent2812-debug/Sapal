/**
 * Schémas JSON-LD globaux (Organization, LocalBusiness, WebSite).
 * Contenu 100% statique côté serveur (aucune entrée utilisateur).
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sapal.fr"

const ORG_ID = `${SITE_URL}/#organization`
const WEBSITE_ID = `${SITE_URL}/#website`

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness"],
  "@id": ORG_ID,
  name: "SAPAL Signalisation",
  alternateName: "SAPAL",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  image: `${SITE_URL}/logo.png`,
  email: "societe@sapal.fr",
  telephone: "+33622902854",
  description:
    "SAPAL Signalisation, fournisseur B2B de mobilier urbain, signalétique routière et équipements d'espaces publics. Basés à Cannes, nous livrons et accompagnons les collectivités partout en France métropolitaine.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "260 Avenue Michel Jourdan",
    addressLocality: "Cannes",
    postalCode: "06150",
    addressRegion: "Provence-Alpes-Côte d'Azur",
    addressCountry: "FR",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 43.5465,
    longitude: 6.9708,
  },
  areaServed: [
    { "@type": "Country", name: "France" },
    { "@type": "AdministrativeArea", name: "France métropolitaine" },
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "+33622902854",
      email: "societe@sapal.fr",
      contactType: "sales",
      areaServed: "FR",
      availableLanguage: ["French"],
    },
  ],
}

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: SITE_URL,
  name: "SAPAL Signalisation",
  inLanguage: "fr-FR",
  publisher: { "@id": ORG_ID },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/recherche?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
}

export function GlobalStructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
    </>
  )
}

export type BreadcrumbItem = { name: string; url: string }

export function BreadcrumbStructuredData({ items }: { items: BreadcrumbItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
