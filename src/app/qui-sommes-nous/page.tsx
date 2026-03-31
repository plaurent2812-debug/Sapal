import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { AnimatedSection, AnimatedItem } from "@/components/ui/motion";
import { ShieldCheck, Users, Award, Truck, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Qui sommes-nous | SAPAL Signalisation",
  description: "Découvrez SAPAL Signalisation, expert en mobilier urbain, signalisation et aménagement de sécurité pour les collectivités.",
};

const VALEURS = [
  {
    icon: ShieldCheck,
    title: "Qualité certifiée",
    description: "Tous nos produits répondent aux normes françaises et européennes les plus strictes. Chaque référence est sélectionnée pour sa durabilité et sa fiabilité.",
  },
  {
    icon: Users,
    title: "Proximité client",
    description: "Un interlocuteur dédié vous accompagne de l'étude de votre projet à la livraison. Nous croyons en une relation de confiance sur le long terme.",
  },
  {
    icon: Award,
    title: "Expertise technique",
    description: "Des années d'expérience dans l'aménagement urbain et la signalisation nous permettent de vous conseiller avec précision sur les solutions adaptées.",
  },
  {
    icon: Truck,
    title: "Logistique maîtrisée",
    description: "Livraison directe sur chantier ou dans vos locaux. Nous gérons l'ensemble de la chaîne logistique pour garantir des délais optimaux.",
  },
];

const CHIFFRES = [
  { value: "500+", label: "Collectivités clientes" },
  { value: "4", label: "Gammes de produits" },
  { value: "100%", label: "Produits aux normes" },
  { value: "48h", label: "Devis sous 48h" },
];

export default function QuiSommesNousPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Hero */}
      <section className="relative w-full py-16 lg:py-24 bg-secondary/20 border-b border-border/50">
        <div className="container px-4 md:px-6 mx-auto">
          <AnimatedSection direction="up">
            <div className="max-w-3xl space-y-4">
              <h1 className="font-heading text-4xl font-extrabold tracking-tight md:text-5xl">
                Qui sommes-nous
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                SAPAL Signalisation est votre partenaire de confiance pour l'aménagement urbain, la signalisation et la sécurité des espaces publics.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Présentation */}
      <section className="container px-4 md:px-6 mx-auto py-16">
        <AnimatedSection direction="up">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="font-heading text-3xl font-bold tracking-tight">
              Spécialiste de l'équipement urbain
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                SAPAL Signalisation est une entreprise spécialisée dans la vente de panneaux de signalisation, de mobilier urbain et de matériel de sécurité à destination des collectivités, entreprises BTP, syndics de copropriétés et grandes enseignes.
              </p>
              <p>
                Notre mission est simple : vous fournir des équipements fiables, durables et conformes aux normes, avec un service d'accompagnement personnalisé à chaque étape de votre projet.
              </p>
              <p>
                Du banc public au panneau de signalisation, de l'abri voyageurs à la barrière de sécurité, nous couvrons l'ensemble des besoins en aménagement des espaces publics et privés.
              </p>
            </div>
          </div>
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted relative">
            <Image
              src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80"
              alt="SAPAL Signalisation"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
        </AnimatedSection>
      </section>

      {/* Chiffres clés */}
      <section className="w-full py-16 bg-muted/30 border-y border-border/50">
        <div className="container px-4 md:px-6 mx-auto">
          <AnimatedSection direction="up">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {CHIFFRES.map((c) => (
                <div key={c.label} className="text-center">
                  <div className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">{c.value}</div>
                  <div className="text-sm text-muted-foreground font-medium">{c.label}</div>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Valeurs */}
      <section className="container px-4 md:px-6 mx-auto py-16">
        <AnimatedSection direction="up">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl font-bold tracking-tight mb-4">Nos valeurs</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Des engagements concrets qui guident notre quotidien et garantissent votre satisfaction.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {VALEURS.map((v) => (
            <div key={v.title} className="flex flex-col items-start p-6 rounded-2xl border border-border/50 bg-card hover:shadow-md transition-shadow">
              <div className="p-3 bg-primary/10 rounded-lg text-primary mb-4">
                <v.icon size={24} />
              </div>
              <h3 className="text-lg font-bold mb-2">{v.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{v.description}</p>
            </div>
          ))}
        </div>
        </AnimatedSection>
      </section>

      {/* CTA */}
      <section className="container px-4 md:px-6 mx-auto">
        <AnimatedSection direction="up">
        <div className="bg-muted/30 border border-border/50 rounded-3xl p-8 md:p-12 text-center">
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">
            Prêt à collaborer ?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Parlons de votre projet d'aménagement. Notre équipe vous accompagne du conseil à la livraison.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="cursor-pointer group">
                Nous contacter
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/catalogue">
              <Button size="lg" variant="outline" className="cursor-pointer">
                Voir le catalogue
              </Button>
            </Link>
          </div>
        </div>
        </AnimatedSection>
      </section>
    </div>
  );
}
