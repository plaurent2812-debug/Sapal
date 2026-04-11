"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedSection } from "@/components/ui/motion";
import { Mail, Phone, MapPin, Send, CheckCircle2, User, MessageSquare } from "lucide-react";
import { useState } from "react";

export default function ContactPageClient() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone") || undefined,
          subject: formData.get("subject"),
          message: formData.get("message"),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'envoi");
      }

      setSuccess(true);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero */}
      <section className="relative w-full py-10 md:py-16 lg:py-24 bg-primary overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.04]"></div>
        <div className="absolute -right-20 -top-20 w-80 h-80 border-[3px] border-accent/15 rounded-full pointer-events-none"></div>
        <div className="container px-4 md:px-6 mx-auto relative z-10">
          <AnimatedSection direction="up">
            <div className="max-w-3xl space-y-3 sm:space-y-4">
              <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight text-white">
                Contactez-nous
              </h1>
              <p className="text-base md:text-lg text-white/60 leading-relaxed">
                Une question, un projet d&apos;aménagement ? Notre équipe est à votre écoute pour vous accompagner dans vos démarches.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section className="container px-4 md:px-6 mx-auto py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 lg:gap-16">
          {/* Coordonnées */}
          <div className="lg:col-span-5 space-y-6 md:space-y-8">
          <AnimatedSection direction="up" delay={0.1}>
            <div>
              <h2 className="font-heading text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Nos coordonnées</h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-accent/10 rounded-xl text-accent flex-shrink-0">
                    <MapPin size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Adresse</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      SAPAL Signalisation<br />
                      260 Av. Michel Jourdan, 06150 Cannes
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-accent/10 rounded-xl text-accent flex-shrink-0">
                    <Mail size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Email</h3>
                    <a href="mailto:societe@sapal.fr" className="text-muted-foreground text-sm hover:text-primary transition-colors">
                      societe@sapal.fr
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-accent/10 rounded-xl text-accent flex-shrink-0">
                    <Phone size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Téléphone</h3>
                    <a href="tel:0622902854" className="text-muted-foreground text-sm hover:text-primary transition-colors">
                      06 22 90 28 54
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-muted/30 rounded-2xl border border-border/50">
              <h3 className="font-semibold mb-2">Horaires d'ouverture</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Lundi - Vendredi : 8h - 17h</p>
                <p>Samedi - Dimanche : Fermé</p>
              </div>
            </div>
          </AnimatedSection>
          </div>

          {/* Formulaire */}
          <div className="lg:col-span-7">
          <AnimatedSection direction="up" delay={0.2}>
            {success ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 border border-border/50 rounded-3xl bg-card">
                <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/50 rounded-full p-5 mb-6">
                  <CheckCircle2 size={48} className="text-green-600 dark:text-green-500" />
                </div>
                <h2 className="font-heading text-2xl font-bold mb-3 text-center">Message envoyé</h2>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  Merci pour votre message. Nous vous répondrons dans les meilleurs délais.
                </p>
                <Button onClick={() => setSuccess(false)} variant="outline" className="cursor-pointer">
                  Envoyer un autre message
                </Button>
              </div>
            ) : (
              <div className="bg-card p-5 sm:p-6 md:p-8 rounded-3xl border border-border/80 shadow-sm">
                <h2 className="font-heading text-xl sm:text-2xl font-bold mb-2">Envoyez-nous un message</h2>
                <p className="text-muted-foreground text-sm mb-6 md:mb-8">
                  Remplissez le formulaire ci-dessous et nous vous répondrons rapidement.
                </p>

                {error && (
                  <div role="alert" className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="contact-name" className="text-sm font-semibold flex items-center gap-2">
                        <User size={16} /> Nom complet <span className="text-destructive">*</span>
                      </label>
                      <Input id="contact-name" name="name" required aria-required="true" placeholder="Jean Dupont" className="bg-muted/20 border-border/80 h-12 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="contact-email" className="text-sm font-semibold flex items-center gap-2">
                        <Mail size={16} /> Email <span className="text-destructive">*</span>
                      </label>
                      <Input id="contact-email" name="email" type="email" required aria-required="true" placeholder="jean@exemple.fr" className="bg-muted/20 border-border/80 h-12 rounded-xl" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="contact-phone" className="text-sm font-semibold flex items-center gap-2">
                        <Phone size={16} /> Téléphone
                      </label>
                      <Input id="contact-phone" name="phone" type="tel" placeholder="01 23 45 67 89" className="bg-muted/20 border-border/80 h-12 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="contact-subject" className="text-sm font-semibold flex items-center gap-2">
                        <MessageSquare size={16} /> Sujet <span className="text-destructive">*</span>
                      </label>
                      <Input id="contact-subject" name="subject" required aria-required="true" placeholder="Demande d'informations" className="bg-muted/20 border-border/80 h-12 rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="contact-message" className="text-sm font-semibold">Message <span className="text-destructive">*</span></label>
                    <textarea
                      id="contact-message"
                      name="message"
                      required
                      aria-required="true"
                      rows={6}
                      className="flex w-full rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:bg-background transition-all resize-none"
                      placeholder="Décrivez votre projet ou votre demande..."
                    />
                  </div>

                  <Button
                    type="submit"
                    className="btn-fill w-full h-12 sm:h-14 rounded-2xl font-bold text-base sm:text-lg cursor-pointer hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-5 w-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin mr-2" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>Envoyer le message <Send size={20} className="ml-2" /></>
                    )}
                  </Button>
                </form>
              </div>
            )}
          </AnimatedSection>
          </div>
        </div>
      </section>
    </div>
  );
}
