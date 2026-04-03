import type { Metadata } from "next"
import Link from "next/link"
import { getProcityProducts } from "@/lib/data"
import { ProcityCatalogueClient } from "@/components/catalogue/procity-catalogue-client"
import { ArrowLeft, Tag } from "lucide-react"

export const metadata: Metadata = {
  title: "Catalogue ProCity | SAPAL Signalisation",
  description: "Découvrez notre gamme complète de produits ProCity : mobilier urbain, aires de jeux, équipements sportifs et miroirs de sécurité. Devis sur mesure en 24h.",
  alternates: { canonical: "/catalogue/procity" },
}

export default async function CatalogueProcityPage() {
  const products = await getProcityProducts()

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* En-tête */}
      <section className="container px-4 md:px-6 mx-auto mt-6 mb-10">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/catalogue"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors"
          >
            <ArrowLeft size={15} /> Catalogue
          </Link>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
            <Tag size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="font-heading text-3xl md:text-4xl tracking-tight text-foreground mb-2">
              Catalogue ProCity
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
              Gamme complète de mobilier urbain, aires de jeux, équipements sportifs et miroirs de sécurité du fabricant ProCity®.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{products.length}</span> produit{products.length !== 1 ? "s" : ""} disponible{products.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </section>

      {/* Catalogue interactif */}
      <section className="container px-4 md:px-6 mx-auto">
        <ProcityCatalogueClient products={products} />
      </section>
    </div>
  )
}
