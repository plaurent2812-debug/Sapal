import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, MapPin, Truck, ChevronRight, CheckCircle2 } from "lucide-react";
import { getCategories, getFeaturedProducts, getProductsCount } from "@/lib/data";
import { ProductCard } from "@/components/catalogue/product-card";
import { AnimatedSection, AnimatedItem, AnimatedCounter } from "@/components/ui/motion";

export const metadata: Metadata = {
  title: "SAPAL Signalisation | Mobilier urbain & signalétique — Livraison France",
  description:
    "Catalogue SAPAL : mobilier urbain, panneaux de signalisation, aires de jeux et équipements publics. Fournisseur B2B basé à Cannes, livraison partout en France métropolitaine. Devis gratuit sous 3h.",
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const categories = await getCategories();
  const featuredProducts = await getFeaturedProducts(4);
  const productsCount = await getProductsCount();

  // Catégorie avec image pour le hero visuel (fallback sur la première dispo)
  const heroCat = categories.find(c => c.imageUrl) ?? categories[0];

  return (
    <div className="flex flex-col min-h-screen w-full bg-background">

      {/* 1. HERO — style maquette : 2 colonnes texte + image, fond gris clair */}
      <section className="relative w-full bg-background">
        <div className="mx-auto max-w-[1600px] px-4 md:px-8 lg:px-12 py-12 md:py-20 lg:py-24">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">

            {/* Colonne texte */}
            <div>
              <AnimatedSection delay={0.05} direction="up">
                <div className="inline-flex items-center gap-2 bg-white border border-border text-foreground px-3 py-1.5 rounded-full text-xs font-semibold mb-5">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  Fournisseur B2B · depuis 1993
                </div>
              </AnimatedSection>

              <AnimatedSection delay={0.1} direction="up">
                <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl tracking-tight text-primary leading-[1.02]">
                  Équipements pour
                  <br />
                  collectivités &amp;
                  <br />
                  espaces publics
                </h1>
              </AnimatedSection>

              <AnimatedSection delay={0.2} direction="up">
                <p className="max-w-xl text-foreground text-base md:text-lg mt-6 leading-relaxed">
                  Mobilier urbain, signalisation, sécurité voirie, aires de jeux. {productsCount} références, livraison France, devis sous 3 h ouvrées.
                </p>
              </AnimatedSection>

              <AnimatedSection delay={0.3} direction="up">
                <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link
                    href="/catalogue"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-6 py-3.5 font-bold rounded-lg flex items-center justify-center gap-2"
                  >
                    Voir le catalogue <ArrowRight size={18} />
                  </Link>
                  <Link
                    href="/contact"
                    className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all px-6 py-3 font-bold rounded-lg flex items-center justify-center"
                  >
                    Demander un devis
                  </Link>
                </div>
              </AnimatedSection>

              {/* Stats hero — style maquette */}
              <AnimatedSection delay={0.4} direction="up">
                <div className="mt-10 grid grid-cols-3 gap-6 pt-6 border-t border-border">
                  <div>
                    <div className="font-heading text-2xl md:text-3xl text-primary leading-none">
                      33 ans
                    </div>
                    <p className="text-xs text-foreground/60 mt-1.5 font-medium">D&apos;expérience</p>
                  </div>
                  <div>
                    <div className="font-heading text-2xl md:text-3xl text-primary leading-none">
                      <AnimatedCounter value={productsCount} />
                    </div>
                    <p className="text-xs text-foreground/60 mt-1.5 font-medium">Références</p>
                  </div>
                  <div>
                    <div className="font-heading text-2xl md:text-3xl text-primary leading-none">96/96</div>
                    <p className="text-xs text-foreground/60 mt-1.5 font-medium">Départements</p>
                  </div>
                </div>
              </AnimatedSection>
            </div>

            {/* Colonne image — rue de Cannes équipée */}
            <AnimatedSection delay={0.15} direction="up">
              <div className="relative bg-card border border-border rounded-2xl p-4 md:p-6 aspect-square shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)] overflow-hidden">
                <div className="relative w-full h-full rounded-xl overflow-hidden bg-background">
                  <Image
                    src="/hero-cannes.png"
                    alt="Rue de Cannes équipée par SAPAL — mobilier urbain, potelets et jardinières"
                    fill
                    sizes="(max-width: 1024px) 100vw, 600px"
                    className="object-cover"
                    priority
                  />
                </div>
                <span className="absolute top-6 right-6 bg-primary text-primary-foreground text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded">
                  Cannes · 2026
                </span>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* 2. BANDEAU DE RÉASSURANCE — ligne sobre sur fond gris */}
      <section className="w-full border-y border-border bg-background">
        <div className="mx-auto max-w-[1600px] px-4 md:px-8 lg:px-12 py-8">
          <AnimatedSection direction="up" delay={0.1}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {[
                { Icon: Truck, title: "Livraison Rapide", desc: "Partout en France" },
                { Icon: ShieldCheck, title: "Qualité Certifiée", desc: "Normes NF / CE" },
                { Icon: CheckCircle2, title: "Devis sous 3h", desc: "Gratuit et sans engagement" },
                { Icon: MapPin, title: "Mandat Administratif", desc: "Paiement à 30 jours" },
              ].map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-border flex items-center justify-center shrink-0">
                    <Icon className="text-primary" size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-primary">{title}</h3>
                    <p className="text-xs text-foreground/70">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* 3. CATÉGORIES — cards blanches avec photos, titres noirs */}
      <section aria-labelledby="section-categories" className="w-full py-12 md:py-16 bg-background">
        <div className="mx-auto max-w-[1600px] px-4 md:px-8 lg:px-12">
          <AnimatedSection direction="up">
            <div className="flex items-end justify-between mb-8 md:mb-10">
              <div>
                <h2 id="section-categories" className="font-heading text-3xl md:text-4xl tracking-tight text-primary">
                  Nos catégories
                </h2>
                <p className="text-foreground/70 text-sm md:text-base mt-2">
                  Parcourez nos {categories.length} univers produits
                </p>
              </div>
              <Link
                href="/catalogue"
                className="hidden sm:flex items-center gap-1 text-sm font-bold text-primary hover:opacity-70 transition-opacity group"
              >
                Voir tout <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {categories.slice(0, 4).map((category, i) => (
              <AnimatedItem key={category.id} delay={i * 0.08}>
                <Link
                  href={`/catalogue/${category.slug}`}
                  className="group bg-card border border-border hover:border-primary/40 transition-all rounded-xl overflow-hidden flex flex-col h-full"
                >
                  <div className="aspect-[4/3] bg-background relative overflow-hidden">
                    {i === 0 && (
                      <span className="absolute top-3 left-3 z-10 bg-primary text-primary-foreground text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded">
                        Best
                      </span>
                    )}
                    {i === 3 && (
                      <span className="absolute top-3 left-3 z-10 bg-primary text-primary-foreground text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded">
                        Nouveau
                      </span>
                    )}
                    {category.imageUrl ? (
                      <Image
                        src={category.imageUrl}
                        alt={category.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-foreground/30 text-xs">
                        Pas d&apos;image
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-primary leading-tight font-heading">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-xs text-foreground/70 mt-1.5 line-clamp-2">
                        {category.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-foreground/60">Voir produits</span>
                      <span className="text-primary font-bold">→</span>
                    </div>
                  </div>
                </Link>
              </AnimatedItem>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/catalogue"
              className="inline-flex items-center gap-2 text-sm font-bold text-primary"
            >
              Voir tout le catalogue <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. PRODUITS PHARES */}
      <section
        aria-labelledby="section-featured"
        className="w-full py-12 md:py-16 bg-background border-t border-border"
      >
        <div className="mx-auto max-w-[1600px] px-4 md:px-8 lg:px-12">
          <AnimatedSection direction="up">
            <div className="flex items-end justify-between mb-8 md:mb-10">
              <div>
                <h2 id="section-featured" className="font-heading text-3xl md:text-4xl tracking-tight text-primary">
                  Notre sélection du moment
                </h2>
                <p className="text-foreground/70 text-sm md:text-base mt-2">
                  Les produits les plus demandés par nos clients
                </p>
              </div>
            </div>
          </AnimatedSection>

          {featuredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {featuredProducts.map((product, i) => {
                const category = categories.find((c) => c.id === product.categoryId);
                return (
                  <AnimatedItem key={product.id} delay={i * 0.08}>
                    <ProductCard product={product} categorySlug={category?.slug || "divers"} />
                  </AnimatedItem>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border text-foreground/60">
              Aucun produit phare pour le moment.
            </div>
          )}
        </div>
      </section>

      {/* 5. CTA FINAL — fond gris clair avec card noire */}
      <section aria-labelledby="section-cta" className="w-full py-12 md:py-20 bg-background">
        <div className="mx-auto max-w-[1600px] px-4 md:px-8 lg:px-12">
          <AnimatedSection direction="up">
            <div className="bg-primary text-primary-foreground rounded-2xl p-8 md:p-14 text-center">
              <h2 id="section-cta" className="font-heading text-2xl sm:text-3xl md:text-5xl mb-4 md:mb-6">
                Un projet d&apos;aménagement ?
              </h2>
              <p className="text-primary-foreground/70 text-base md:text-lg max-w-2xl mx-auto mb-8 md:mb-10">
                Nos experts vous accompagnent de la conception à la livraison.
                Obtenez votre devis personnalisé sous 3h.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto">
                <Link
                  href="/contact"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 transition-all px-8 sm:px-10 py-3.5 sm:py-4 font-bold rounded-lg duration-300 text-center"
                >
                  Demander un devis gratuit
                </Link>
                <Link
                  href="/catalogue"
                  className="text-primary-foreground/80 hover:text-primary-foreground transition-colors font-bold flex items-center justify-center gap-2 py-3"
                >
                  Parcourir le catalogue <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

    </div>
  );
}
