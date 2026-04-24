import { Button } from "@/components/ui/button";
import { AnimatedSection, AnimatedItem } from "@/components/ui/motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Réalisations — Projets d'aménagement urbain",
  description:
    "Découvrez nos projets d'aménagement urbain et de signalisation réalisés pour les collectivités françaises : mobilier urbain, panneaux, abris voyageurs, sécurisation. Basés à Cannes, livraison partout en France.",
  alternates: { canonical: "/realisations" },
};

const REALISATIONS = [
  {
    title: "Réaménagement centre-ville",
    location: "Collectivité territoriale",
    description: "Installation complète de mobilier urbain : bancs, corbeilles, jardinières et signalisation directionnelle pour le nouveau centre piétonnier.",
    category: "Mobilier Urbain",
    imageUrl: "https://images.unsplash.com/photo-1519121785383-3229633bb75b?w=800&q=80",
  },
  {
    title: "Mise en conformité signalisation",
    location: "Commune Île-de-France",
    description: "Remplacement de 120 panneaux de signalisation routière aux normes NF. Pose de miroirs de sécurité aux intersections sensibles.",
    category: "Signalisation",
    imageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80",
  },
  {
    title: "Pôle d'échange multimodal",
    location: "Métropole régionale",
    description: "Fourniture et installation de 8 abris voyageurs, 30 supports vélos et 2 abris vélos sécurisés pour le nouveau pôle de transport.",
    category: "Abris et Cycles",
    imageUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80",
  },
  {
    title: "Sécurisation zone scolaire",
    location: "Commune du Sud-Ouest",
    description: "Mise en place de barrières de ville, bornes anti-stationnement et portiques de limitation de hauteur autour du groupe scolaire.",
    category: "Aménagement Sécurité",
    imageUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80",
  },
  {
    title: "Parc urbain nouvelle génération",
    location: "Agglomération Grand Est",
    description: "Aménagement complet du parc avec mobilier urbain design, éclairage et signalétique intégrée. 45 bancs, 20 corbeilles, jardinières sur-mesure.",
    category: "Mobilier Urbain",
    imageUrl: "https://images.unsplash.com/photo-1585938389612-a552a28d6914?w=800&q=80",
  },
  {
    title: "Zone commerciale sécurisée",
    location: "Enseigne nationale",
    description: "Installation de bornes anti-bélier, barrières de régulation et signalisation d'accès pour protéger la zone piétonne du centre commercial.",
    category: "Aménagement Sécurité",
    imageUrl: "https://images.unsplash.com/photo-1567449303078-57ad995bd329?w=800&q=80",
  },
];

export default function RealisationsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Hero */}
      <section className="relative w-full py-10 md:py-16 lg:py-24 bg-secondary/20 border-b border-border/50">
        <div className="container px-4 md:px-6 mx-auto">
          <AnimatedSection direction="up">
            <div className="max-w-3xl space-y-3 sm:space-y-4">
              <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
                Nos Réalisations
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                Découvrez une sélection de projets réalisés pour des collectivités, entreprises et établissements publics à travers la France.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Grid */}
      <section className="container px-4 md:px-6 mx-auto mt-10 md:mt-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
          {REALISATIONS.map((projet, i) => (
            <AnimatedItem key={i} delay={i * 0.05}>
            <div
              className="group flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-muted relative">
                <Image
                  src={projet.imageUrl}
                  alt={projet.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
                  <span className="bg-background/90 backdrop-blur-sm text-[11px] sm:text-xs font-semibold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-border/50">
                    {projet.category}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold mb-1">{projet.title}</h3>
                <p className="text-sm text-primary/70 font-medium mb-3">{projet.location}</p>
                <p className="text-muted-foreground text-sm flex-1 leading-relaxed">
                  {projet.description}
                </p>
              </div>
            </div>
            </AnimatedItem>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container px-4 md:px-6 mx-auto mt-12 md:mt-20">
        <AnimatedSection direction="up">
        <div className="bg-muted/30 border border-border/50 rounded-3xl p-6 sm:p-8 md:p-12 text-center">
          <h2 className="font-heading text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">
            Un projet d'aménagement ?
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto mb-6 sm:mb-8">
            Contactez notre équipe pour bénéficier d'un accompagnement personnalisé et d'un devis sur-mesure pour votre collectivité ou entreprise.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/catalogue">
              <Button size="lg" className="w-full sm:w-auto cursor-pointer group">
                Voir le catalogue
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="w-full sm:w-auto cursor-pointer">
                Nous contacter
              </Button>
            </Link>
          </div>
        </div>
        </AnimatedSection>
      </section>
    </div>
  );
}
