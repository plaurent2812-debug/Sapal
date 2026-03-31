import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, MapPin, Truck, ChevronRight, CheckCircle2 } from "lucide-react";
import { getCategories, getFeaturedProducts, getProductsCount } from "@/lib/data";
import { ProductCard } from "@/components/catalogue/product-card";
import { AnimatedSection, AnimatedItem, AnimatedCounter } from "@/components/ui/motion";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "SAPAL Signalisation | Mobilier Urbain & Signalétique pour Collectivités",
  description:
    "Découvrez le catalogue SAPAL : mobilier urbain, panneaux de signalisation, aires de jeux et équipements d'espaces publics. Fournisseur B2B pour collectivités. Devis gratuit sous 3h.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const categories = await getCategories();
  const featuredProducts = await getFeaturedProducts(4);
  const productsCount = await getProductsCount();

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SAPAL Signalisation",
    url: "https://www.sapal-signaletique.fr",
    email: "societe@sapal.fr",
    description:
      "Fournisseur B2B de mobilier urbain, signalétique et équipements d'espaces publics pour les collectivités françaises.",
    areaServed: {
      "@type": "Country",
      name: "France",
    },
  };

  return (
    <div className="flex flex-col min-h-screen w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      {/* 1. HERO — Asymétrique, distinctif */}
      <section className="relative w-full bg-primary overflow-hidden">
        {/* Pattern de fond subtil */}
        <div className="absolute inset-0 bg-grid opacity-[0.03]"></div>
        <div className="absolute right-0 top-0 h-full w-2/3 bg-gradient-to-l from-accent/15 to-transparent pointer-events-none"></div>

        {/* Forme géométrique décorative */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 border-[3px] border-accent/20 rounded-full pointer-events-none"></div>
        <div className="absolute -right-10 -bottom-10 w-60 h-60 border-[3px] border-accent/10 rounded-full pointer-events-none"></div>

        <div className="container px-4 md:px-6 mx-auto relative z-10 py-20 md:py-28 lg:py-32">
          <div className="max-w-4xl">


            <AnimatedSection delay={0.1} direction="up">
              <h1 className="font-heading text-4xl sm:text-5xl md:text-7xl lg:text-8xl tracking-tight text-white mb-6 leading-[0.95]">
                L&apos;excellence au service
                <br />
                <span className="relative inline-block mt-2">
                  des <span className="text-accent">Collectivités</span>
                  <div className="absolute -bottom-3 left-0 w-full h-1 bg-gradient-to-r from-accent to-accent/0 rounded-full"></div>
                </span>
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={0.25} direction="up">
              <p className="max-w-xl text-white/70 text-lg md:text-xl mb-10 leading-relaxed">
                Plus de {productsCount} références conformes aux normes routières.
                Mobilier urbain, signalisation et sécurité au meilleur prix.
              </p>
            </AnimatedSection>

            <AnimatedSection delay={0.35} direction="up">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4">
                <Link href="/catalogue" className="btn-fill bg-accent text-accent-foreground hover:bg-accent/90 transition-all px-8 py-4 font-bold rounded-lg flex items-center justify-center gap-3 shadow-xl shadow-accent/20 hover:-translate-y-0.5 duration-300">
                  Explorer le catalogue <ArrowRight size={20} />
                </Link>
                <Link href="/contact" className="bg-white/5 text-white hover:bg-white/10 backdrop-blur-sm border border-white/15 transition-all px-8 py-4 font-bold rounded-lg flex items-center justify-center hover:-translate-y-0.5 duration-300">
                  Devis sur mesure
                </Link>
              </div>
            </AnimatedSection>
          </div>
        </div>

        {/* Divider angulaire */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 60L1440 60L1440 20L0 60Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* 2. BARRE DE RÉASSURANCE — Avec compteurs animés */}
      <section className="w-full bg-white py-8 relative z-20">
        <div className="container px-4 md:px-6 mx-auto">
          <AnimatedSection direction="up" delay={0.1}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              <div className="flex flex-col items-center text-center group">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors duration-300">
                  <Truck className="text-accent" size={26} />
                </div>
                <h3 className="text-sm font-bold text-foreground">Livraison Rapide</h3>
                <p className="text-xs text-muted-foreground mt-1">Partout en France</p>
              </div>
              <div className="flex flex-col items-center text-center group">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors duration-300">
                  <ShieldCheck className="text-accent" size={26} />
                </div>
                <h3 className="text-sm font-bold text-foreground">Qualité Certifiée</h3>
                <p className="text-xs text-muted-foreground mt-1">Normes NF / CE</p>
              </div>
              <div className="flex flex-col items-center text-center group">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors duration-300">
                  <CheckCircle2 className="text-accent" size={26} />
                </div>
                <h3 className="text-sm font-bold text-foreground">Devis sous 3h</h3>
                <p className="text-xs text-muted-foreground mt-1">Gratuit et sans engagement</p>
              </div>
              <div className="flex flex-col items-center text-center group">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors duration-300">
                  <MapPin className="text-accent" size={26} />
                </div>
                <h3 className="text-sm font-bold text-foreground">Mandat Administratif</h3>
                <p className="text-xs text-muted-foreground mt-1">Paiement à 30 jours</p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="w-full bg-primary py-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.04]"></div>
        <div className="container px-4 md:px-6 mx-auto relative z-10">
          <div className="grid grid-cols-3 gap-4 md:gap-8 text-center text-white">
            <div>
              <AnimatedCounter value={productsCount} suffix="" className="text-3xl md:text-4xl font-heading text-accent" />
              <p className="text-sm text-white/60 mt-2">Références</p>
            </div>
            <div>
              <AnimatedCounter value={3} suffix="h" className="text-3xl md:text-4xl font-heading text-accent" />
              <p className="text-sm text-white/60 mt-2">Délai de devis</p>
            </div>
            <div>
              <AnimatedCounter value={7} suffix=" ans" className="text-3xl md:text-4xl font-heading text-accent" />
              <p className="text-sm text-white/60 mt-2">D'expérience</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ACCÈS RAPIDE AUX CATÉGORIES */}
      <section aria-labelledby="section-categories" className="w-full py-20 bg-secondary/10">
        <div className="container px-4 md:px-6 mx-auto">
          <AnimatedSection direction="up">
            <div className="flex items-center justify-between mb-10">
              <h2 id="section-categories" className="font-heading text-3xl md:text-4xl tracking-tight text-foreground accent-line">
                Nos Catégories
              </h2>
              <Link href="/catalogue" className="hidden sm:flex items-center gap-1 text-sm font-bold text-primary hover:text-accent transition-colors group">
                Voir tout <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.slice(0, 12).map((category, i) => (
              <AnimatedItem key={category.id} delay={i * 0.05}>
                <Link
                  href={`/catalogue/${category.slug}`}
                  className="group bg-white border border-border hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 rounded-xl p-5 flex flex-col items-center text-center h-full hover:-translate-y-1"
                >
                  <div className="w-16 h-16 bg-secondary/30 rounded-full mb-3 flex items-center justify-center overflow-hidden border border-border/50 p-2 group-hover:border-accent/30 transition-colors relative">
                    {category.imageUrl ? (
                      <Image src={category.imageUrl} alt={category.name} fill sizes="64px" className="object-contain p-2 group-hover:scale-110 transition-transform duration-500" unoptimized />
                    ) : (
                      <div className="w-8 h-8 bg-border rounded-full" />
                    )}
                  </div>
                  <h3 className="text-[13px] font-bold leading-tight group-hover:text-accent transition-colors">{category.name}</h3>
                </Link>
              </AnimatedItem>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link href="/catalogue" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-accent transition-colors">
              Voir tout le catalogue <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. PRODUITS PHARES */}
      <section aria-labelledby="section-featured" className="w-full py-20 bg-white relative overflow-hidden">
        {/* Déco subtile */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="container px-4 md:px-6 mx-auto relative z-10">
          <AnimatedSection direction="up">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 id="section-featured" className="font-heading text-3xl md:text-4xl tracking-tight text-foreground">
                  Notre sélection du moment
                </h2>
                <p className="text-muted-foreground mt-2">Les produits les plus demandés par nos clients</p>
              </div>
            </div>
          </AnimatedSection>

          {featuredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product, i) => {
                const category = categories.find(c => c.id === product.categoryId);
                return (
                  <AnimatedItem key={product.id} delay={i * 0.1}>
                    <ProductCard
                      product={product}
                      categorySlug={category?.slug || 'divers'}
                    />
                  </AnimatedItem>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-secondary/20 rounded-xl border border-dashed border-border text-muted-foreground">
              Aucun produit phare pour le moment.
            </div>
          )}
        </div>
      </section>

      {/* 5. CTA FINAL */}
      <section aria-labelledby="section-cta" className="w-full py-20 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.04]"></div>
        <div className="absolute left-0 top-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

        <div className="container px-4 md:px-6 mx-auto relative z-10 text-center">
          <AnimatedSection direction="up">
            <h2 id="section-cta" className="font-heading text-3xl md:text-5xl text-white mb-6">
              Un projet d&apos;aménagement ?
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto mb-10">
              Nos experts vous accompagnent de la conception à la livraison. Obtenez votre devis personnalisé sous 3h.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 max-w-md sm:max-w-none mx-auto">
              <Link href="/contact" className="btn-fill bg-accent text-accent-foreground hover:bg-accent/90 transition-all px-10 py-4 font-bold rounded-lg shadow-xl shadow-accent/20 hover:-translate-y-0.5 duration-300 text-center">
                Demander un devis gratuit
              </Link>
              <Link href="/catalogue" className="text-white/80 hover:text-white transition-colors font-bold flex items-center justify-center gap-2 py-3">
                Parcourir le catalogue <ArrowRight size={18} />
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

    </div>
  );
}
