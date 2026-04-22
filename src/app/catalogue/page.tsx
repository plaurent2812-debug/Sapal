import Link from "next/link";
import Image from "next/image";
import { getCategories, getCategoryThumbnails } from "@/lib/data";
import { ChevronRight, ArrowRight, ShieldCheck, Truck, Clock } from "lucide-react";
import { AnimatedSection, AnimatedItem } from "@/components/ui/motion";

export const metadata = {
  title: "Catalogue | SAPAL Signalisation",
  description: "Découvrez notre gamme complète d'équipements urbains.",
};

export default async function CataloguePage() {
  const categories = await getCategories();
  const thumbs = await getCategoryThumbnails(categories.map((c) => c.id));

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* 1. BANNIÈRE PROMOTIONNELLE */}
      <section className="container px-4 md:px-6 mx-auto mt-6 mb-10 md:mb-14">
        <AnimatedSection direction="up">
          <div className="w-full bg-gradient-to-br from-primary via-primary to-[#1a2b4b] rounded-2xl overflow-hidden shadow-lg relative">
            <div className="absolute inset-0 bg-grid opacity-[0.04]"></div>
            <div className="absolute -right-20 -bottom-20 w-80 h-80 border-[3px] border-accent/15 rounded-full pointer-events-none"></div>
            <div className="absolute -right-10 -bottom-10 w-60 h-60 border-[3px] border-accent/10 rounded-full pointer-events-none"></div>

            <div className="flex flex-col md:flex-row items-center relative">
              <div className="p-6 sm:p-8 md:p-12 lg:p-16 flex-1 z-10 w-full text-white">
                <div className="inline-block bg-accent/15 text-accent text-[11px] sm:text-xs font-bold uppercase tracking-widest px-3 sm:px-4 py-1.5 mb-4 sm:mb-5 rounded-full border border-accent/30">
                  Nouveautés 2026
                </div>
                <h1 className="font-heading text-2xl sm:text-3xl md:text-5xl tracking-tight mb-4 leading-tight">
                  Spécial Collectivités &<br />Aménagement Public
                </h1>
                <p className="text-white/70 text-base md:text-xl mb-6 md:mb-8 max-w-xl leading-relaxed">
                  Découvrez nos nouvelles gammes de mobilier urbain et de signalisation aux normes. Sur devis en 24h.
                </p>
                <Link href="/catalogue/mobilier-urbain" className="btn-fill inline-flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90 transition-all px-6 sm:px-8 py-3 sm:py-3.5 font-bold rounded-lg shadow-lg shadow-accent/20 hover:-translate-y-0.5 duration-300">
                  Explorer la gamme <ArrowRight size={18} />
                </Link>
              </div>

              <div className="hidden lg:flex p-12 pr-16 items-center justify-center relative z-10 gap-6">
                {[
                  { icon: ShieldCheck, label: "Certifié Pro" },
                  { icon: Truck, label: "Livraison France" },
                  { icon: Clock, label: "Devis 24H" },
                ].map(({ icon: Icon, label }, i) => (
                  <AnimatedItem key={label} delay={0.2 + i * 0.1}>
                    <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 text-center flex flex-col items-center hover:bg-white/10 transition-colors duration-300">
                      <Icon size={36} className="text-accent mb-3" />
                      <span className="font-bold text-white uppercase text-sm tracking-wide">{label}</span>
                    </div>
                  </AnimatedItem>
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* 2. CATÉGORIES */}
      <section className="container px-4 md:px-6 mx-auto">
        <AnimatedSection direction="up">
          <div className="flex items-center gap-3 mb-6 md:mb-10">
            <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl tracking-tight text-foreground accent-line">
              Nos catégories de produits
            </h2>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((category, i) => (
            <AnimatedItem key={category.id} delay={i * 0.05}>
              <Link
                href={`/catalogue/${category.slug}`}
                className="group flex items-center bg-white border border-border/60 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 rounded-xl p-4 overflow-hidden hover:-translate-y-1"
              >
                <div className="w-20 h-20 flex-shrink-0 bg-gradient-to-br from-secondary/40 to-secondary/10 rounded-lg flex items-center justify-center overflow-hidden mr-4 border border-border/30 relative">
                  {(category.imageUrl || thumbs[category.id]) ? (
                    <Image
                      src={category.imageUrl || thumbs[category.id]}
                      alt={category.name}
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
                    {category.name}
                  </h3>
                  <ChevronRight size={20} className="text-accent flex-shrink-0 -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </div>
              </Link>
            </AnimatedItem>
          ))}
        </div>
      </section>
    </div>
  );
}
