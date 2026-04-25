import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { getCategoriesBySupplier, getCategoryThumbnailsBySupplier } from "@/lib/data"
import { AnimatedSection, AnimatedItem } from "@/components/ui/motion"
import { ArrowLeft, ChevronRight } from "lucide-react"

const SUPPLIER = "procity"

export const metadata: Metadata = {
  title: "Catalogue Procity | SAPAL Signalisation",
  description:
    "Catalogue complet Procity : mobilier urbain, aires de jeux, équipements sportifs et miroirs de sécurité. Retrouvez toutes les références Procity triées selon la taxonomie fabricant.",
  alternates: { canonical: "/catalogue/fournisseurs/procity" },
}

export const dynamic = "force-dynamic"

export default async function CatalogueProcityPage() {
  const universes = await getCategoriesBySupplier(SUPPLIER)
  const thumbs = await getCategoryThumbnailsBySupplier(universes.map((u) => u.id), SUPPLIER)

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <section className="container px-4 md:px-6 mx-auto mt-6 md:mt-10 mb-10">
        <Link
          href="/catalogue"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 md:mb-6 transition-colors group"
        >
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
          Retour au catalogue
        </Link>

        <AnimatedSection direction="up">
          <div className="mb-8 md:mb-10">
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight text-foreground accent-line">
              Catalogue Procity
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mt-3 max-w-2xl">
              Retrouvez les produits Procity rangés selon la taxonomie du fabricant. Cliquez sur un univers pour découvrir ses catégories et produits.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {universes.map((universe, i) => (
            <AnimatedItem key={universe.id} delay={i * 0.05}>
              <Link
                href={`/catalogue/fournisseurs/procity/${universe.slug}`}
                className="group flex items-center bg-white border border-border/60 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 rounded-xl p-4 overflow-hidden hover:-translate-y-1"
              >
                <div className="w-20 h-20 flex-shrink-0 bg-gradient-to-br from-secondary/40 to-secondary/10 rounded-lg flex items-center justify-center overflow-hidden mr-4 border border-border/30 relative">
                  {(universe.imageUrl || thumbs[universe.id]) ? (
                    <Image
                      src={universe.imageUrl || thumbs[universe.id]}
                      alt={universe.name}
                      fill
                      sizes="80px"
                      priority={i === 0}
                      className="object-contain p-1 group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-border text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <h3 className="font-bold text-sm md:text-base leading-tight pr-2 group-hover:text-accent transition-colors">
                    {universe.name}
                  </h3>
                  <ChevronRight
                    size={20}
                    className="text-accent flex-shrink-0 -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
                  />
                </div>
              </Link>
            </AnimatedItem>
          ))}
        </div>
      </section>
    </div>
  )
}
