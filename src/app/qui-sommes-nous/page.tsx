import { Button } from "@/components/ui/button";
import { AnimatedSection } from "@/components/ui/motion";
import Link from "next/link";
import { ShieldCheck, Users, Award, Truck, ArrowRight, type LucideIcon } from "lucide-react";
import { EditableText } from "@/components/edit-mode/EditableText";
import { EditableImage } from "@/components/edit-mode/EditableImage";
import { EditableList } from "@/components/edit-mode/EditableList";
import { getPublishedValue } from "@/lib/site-content/server";
import type { ListValue } from "@/lib/site-content/types";

export const metadata = {
  title: "Qui sommes-nous — SAPAL Signalisation Cannes",
  description:
    "SAPAL Signalisation, expert en mobilier urbain, signalisation et aménagement de sécurité pour les collectivités. Basés à Cannes (06), nous livrons partout en France métropolitaine.",
  alternates: { canonical: "/qui-sommes-nous" },
};

const VALEURS_ICON_MAP: Record<string, LucideIcon> = {
  shield: ShieldCheck,
  users: Users,
  award: Award,
  truck: Truck,
};

const VALEURS_DEFAULT = [
  {
    icon: "shield",
    title: "Qualité certifiée",
    description:
      "Tous nos produits répondent aux normes françaises et européennes les plus strictes. Chaque référence est sélectionnée pour sa durabilité et sa fiabilité.",
  },
  {
    icon: "users",
    title: "Proximité client",
    description:
      "Un interlocuteur dédié vous accompagne de l'étude de votre projet à la livraison. Nous croyons en une relation de confiance sur le long terme.",
  },
  {
    icon: "award",
    title: "Expertise technique",
    description:
      "Des années d'expérience dans l'aménagement urbain et la signalisation nous permettent de vous conseiller avec précision sur les solutions adaptées.",
  },
  {
    icon: "truck",
    title: "Logistique maîtrisée",
    description:
      "Livraison directe sur chantier ou dans vos locaux. Nous gérons l'ensemble de la chaîne logistique pour garantir des délais optimaux.",
  },
];

const CHIFFRES_DEFAULT = [
  { value: "500+", label: "Collectivités clientes" },
  { value: "4", label: "Gammes de produits" },
  { value: "100%", label: "Produits aux normes" },
  { value: "48h", label: "Devis sous 48h" },
];

export default async function QuiSommesNousPage() {
  const chiffres = await getPublishedValue<ListValue>('about', 'about.chiffres', CHIFFRES_DEFAULT);
  const valeurs = await getPublishedValue<ListValue>('about', 'about.valeurs.items', VALEURS_DEFAULT);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Hero */}
      <section className="relative w-full py-10 md:py-16 lg:py-24 bg-secondary/20 border-b border-border/50">
        <div className="container px-4 md:px-6 mx-auto">
          <AnimatedSection direction="up">
            <div className="max-w-3xl space-y-3 sm:space-y-4">
              <EditableText
                keyName="about.hero.title"
                page="about"
                as="h1"
                className="font-heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight"
                defaultValue="Qui sommes-nous"
              />
              <EditableText
                keyName="about.hero.subtitle"
                page="about"
                as="p"
                multiline
                className="text-base md:text-lg text-muted-foreground leading-relaxed"
                defaultValue="SAPAL Signalisation est votre partenaire de confiance pour l'aménagement urbain, la signalisation et la sécurité des espaces publics."
              />
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Présentation */}
      <section className="container px-4 md:px-6 mx-auto py-10 md:py-16">
        <AnimatedSection direction="up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="space-y-4 sm:space-y-6">
              <EditableText
                keyName="about.presentation.title"
                page="about"
                as="h2"
                className="font-heading text-xl sm:text-2xl md:text-3xl font-bold tracking-tight"
                defaultValue="Spécialiste de l'équipement urbain"
              />
              <div className="space-y-3 sm:space-y-4 text-muted-foreground text-sm sm:text-base leading-relaxed">
                <EditableText
                  keyName="about.presentation.p1"
                  page="about"
                  as="p"
                  multiline
                  defaultValue="SAPAL Signalisation est une entreprise spécialisée dans la vente de panneaux de signalisation, de mobilier urbain et de matériel de sécurité à destination des collectivités, entreprises BTP, syndics de copropriétés et grandes enseignes."
                />
                <EditableText
                  keyName="about.presentation.p2"
                  page="about"
                  as="p"
                  multiline
                  defaultValue="Basés à Cannes (Alpes-Maritimes), nous livrons et accompagnons nos clients partout en France métropolitaine. Notre ancrage sur la Côte d'Azur nous permet une réactivité forte en PACA, tout en servant chaque jour des collectivités et entreprises sur l'ensemble du territoire national."
                />
                <EditableText
                  keyName="about.presentation.p3"
                  page="about"
                  as="p"
                  multiline
                  defaultValue="Notre mission est simple : vous fournir des équipements fiables, durables et conformes aux normes, avec un service d'accompagnement personnalisé à chaque étape de votre projet."
                />
                <EditableText
                  keyName="about.presentation.p4"
                  page="about"
                  as="p"
                  multiline
                  defaultValue="Du banc public au panneau de signalisation, de l'abri voyageurs à la barrière de sécurité, nous couvrons l'ensemble des besoins en aménagement des espaces publics et privés."
                />
              </div>
            </div>
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted relative order-first lg:order-last">
              <EditableImage
                keyName="about.presentation.image"
                page="about"
                defaultUrl="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80"
                defaultAlt="SAPAL Signalisation"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* Chiffres clés */}
      <section className="w-full py-10 md:py-16 bg-muted/30 border-y border-border/50">
        <div className="container px-4 md:px-6 mx-auto">
          <AnimatedSection direction="up">
            <EditableList
              keyName="about.chiffres"
              page="about"
              title="chiffres clés"
              schema={[
                { name: "value", label: "Valeur", type: "text", placeholder: "500+" },
                { name: "label", label: "Libellé", type: "text" },
              ]}
              defaultValue={chiffres}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
                {chiffres.map((c, i) => (
                  <div key={i} className="text-center">
                    <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
                      {String(c.value ?? "")}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground font-medium">
                      {String(c.label ?? "")}
                    </div>
                  </div>
                ))}
              </div>
            </EditableList>
          </AnimatedSection>
        </div>
      </section>

      {/* Valeurs */}
      <section className="container px-4 md:px-6 mx-auto py-10 md:py-16">
        <AnimatedSection direction="up">
          <div className="text-center mb-8 md:mb-12">
            <EditableText
              keyName="about.valeurs.title"
              page="about"
              as="h2"
              className="font-heading text-2xl sm:text-3xl font-bold tracking-tight mb-3 sm:mb-4"
              defaultValue="Nos valeurs"
            />
            <EditableText
              keyName="about.valeurs.subtitle"
              page="about"
              as="p"
              multiline
              className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto"
              defaultValue="Des engagements concrets qui guident notre quotidien et garantissent votre satisfaction."
            />
          </div>
          <EditableList
            keyName="about.valeurs.items"
            page="about"
            title="valeurs"
            schema={[
              { name: "icon", label: "Icône (shield, users, award, truck)", type: "text" },
              { name: "title", label: "Titre", type: "text" },
              { name: "description", label: "Description", type: "textarea" },
            ]}
            defaultValue={valeurs}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
              {valeurs.map((v, i) => {
                const Icon = VALEURS_ICON_MAP[String(v.icon || "shield")] ?? ShieldCheck;
                return (
                  <div
                    key={i}
                    className="flex flex-col items-start p-5 sm:p-6 rounded-2xl border border-border/50 bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="p-3 bg-primary/10 rounded-lg text-primary mb-4">
                      <Icon size={24} />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{String(v.title ?? "")}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {String(v.description ?? "")}
                    </p>
                  </div>
                );
              })}
            </div>
          </EditableList>
        </AnimatedSection>
      </section>

      {/* CTA */}
      <section className="container px-4 md:px-6 mx-auto">
        <AnimatedSection direction="up">
          <div className="bg-muted/30 border border-border/50 rounded-3xl p-6 sm:p-8 md:p-12 text-center">
            <EditableText
              keyName="about.cta.title"
              page="about"
              as="h2"
              className="font-heading text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4"
              defaultValue="Prêt à collaborer ?"
            />
            <EditableText
              keyName="about.cta.description"
              page="about"
              as="p"
              multiline
              className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto mb-6 sm:mb-8"
              defaultValue="Parlons de votre projet d'aménagement. Notre équipe vous accompagne du conseil à la livraison."
            />
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="w-full sm:w-auto cursor-pointer group">
                  Nous contacter
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/catalogue">
                <Button size="lg" variant="outline" className="w-full sm:w-auto cursor-pointer">
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
