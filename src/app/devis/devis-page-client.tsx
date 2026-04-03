"use client"
import Link from 'next/link';
import Image from 'next/image';
import { useQuoteStore } from '@/store/useQuoteStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatedSection } from '@/components/ui/motion';
import { Trash2, Send, CheckCircle2, ArrowLeft, Building2, User, Mail, Phone, FileText, ShoppingCart, Minus, Plus, ArrowRight, Clock } from 'lucide-react';
import { useState } from 'react';

export default function DevisPageClient() {
  const { items, removeItem, updateQuantity, clearCart } = useQuoteStore();
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
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: formData.get('entity'),
          contactName: formData.get('contactName'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          message: formData.get('message') || undefined,
          items: items.map(item => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.price,
            delai: item.variantDelai || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de l\'envoi');
      }

      setSuccess(true);
      clearCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <AnimatedSection direction="up">
          <div className="text-center">
            <div className="bg-green-50/50 border border-green-200 rounded-full p-6 mb-8 inline-block">
              <CheckCircle2 size={80} className="text-green-600" />
            </div>
            <h1 className="font-heading text-4xl md:text-5xl mb-6 tracking-tight">
              Demande envoyée avec succès
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Merci pour votre confiance. Nos équipes vont étudier votre demande et vous recontacter dans les plus brefs délais avec une proposition détaillée.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/catalogue">
                <Button size="lg" className="btn-fill rounded-xl px-8 h-14 text-lg cursor-pointer">
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  Retourner au catalogue
                </Button>
              </Link>
            </div>
          </div>
        </AnimatedSection>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Header de page */}
      <div className="bg-primary py-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.04]"></div>
        <div className="container px-4 md:px-6 mx-auto relative z-10">
          <AnimatedSection direction="up">
            <div className="flex flex-col md:flex-row items-baseline gap-4">
              <h1 className="font-heading text-3xl md:text-5xl text-white tracking-tight">Mon Devis</h1>
              <p className="text-white/50 text-lg">
                {totalItems > 0 ? `${totalItems} produit${totalItems > 1 ? 's' : ''} sélectionné${totalItems > 1 ? 's' : ''}` : "Votre sélection est vide"}
              </p>
            </div>
          </AnimatedSection>
        </div>
      </div>

      <div className="container py-10 px-4 md:px-6 mx-auto">
        {items.length === 0 ? (
          <AnimatedSection direction="up" delay={0.1}>
            <div className="flex flex-col items-center justify-center py-20 px-4 mt-4 border-2 border-dashed border-border/60 rounded-2xl bg-card">
              <div className="h-20 w-20 rounded-full bg-secondary/50 flex items-center justify-center mb-6">
                <ShoppingCart size={36} className="text-muted-foreground/50" />
              </div>
              <h2 className="font-heading text-2xl mb-3">Aucun produit sélectionné</h2>
              <p className="text-muted-foreground mb-8 text-center max-w-md">Parcourez notre catalogue et ajoutez des équipements à votre demande de devis.</p>
              <Link href="/catalogue">
                <Button size="lg" className="btn-fill rounded-xl px-8 font-semibold cursor-pointer shadow-lg shadow-primary/20">
                  Parcourir le catalogue <ArrowRight size={18} className="ml-2" />
                </Button>
              </Link>
            </div>
          </AnimatedSection>
        ) : (
          <AnimatedSection direction="up" delay={0.1}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">

              {/* Liste des articles */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                {items.map((item) => (
                  <div key={item.product.id} className="bg-card rounded-xl border border-border/40 p-4 md:p-5 hover:border-border transition-colors">
                    <div className="flex gap-4">
                      {/* Image */}
                      <Link href={item.product.categorySlug ? `/catalogue/${item.product.categorySlug}/${item.product.slug}` : `/catalogue`} className="h-20 w-20 md:h-24 md:w-24 bg-secondary/20 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center relative hover:ring-2 hover:ring-accent/30 transition-all">
                        {item.product.imageUrl ? (
                          <Image src={item.product.imageUrl} alt={item.product.name} fill sizes="96px" className="object-contain p-2" />
                        ) : (
                          <FileText size={24} className="text-muted-foreground/30" />
                        )}
                      </Link>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link href={item.product.categorySlug ? `/catalogue/${item.product.categorySlug}/${item.product.slug}` : `/catalogue`} className="font-bold text-foreground leading-tight truncate block hover:text-accent transition-colors">{item.product.name}</Link>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.product.description}</p>
                            {item.product.reference && (
                              <p className="text-[10px] font-mono text-muted-foreground mt-1">Réf. {item.product.reference}</p>
                            )}
                          </div>
                          <button onClick={() => removeItem(item.product.id)} className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-all cursor-pointer flex-shrink-0" aria-label={`Retirer ${item.product.name}`}>
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Prix + Quantité */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-0 bg-secondary/30 rounded-lg ring-1 ring-border/50">
                            <button onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))} className="w-8 h-8 rounded-l-lg flex items-center justify-center text-foreground hover:bg-background transition-colors disabled:opacity-40 cursor-pointer" disabled={item.quantity <= 1} aria-label={`Réduire la quantité de ${item.product.name}`}>
                              <Minus size={14} />
                            </button>
                            <span className="w-10 h-8 text-center font-bold text-sm flex items-center justify-center border-x border-border/50" aria-label={`Quantité : ${item.quantity}`}>{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="w-8 h-8 rounded-r-lg flex items-center justify-center text-foreground hover:bg-background transition-colors cursor-pointer" aria-label={`Augmenter la quantité de ${item.product.name}`}>
                              <Plus size={14} />
                            </button>
                          </div>

                          <div className="flex items-center gap-4">
                            {item.variantDelai && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/30 px-2.5 py-1 rounded-lg">
                                <Clock size={12} className="text-accent" /> {/^\d+$/.test(item.variantDelai) ? `${item.variantDelai} semaines` : item.variantDelai}
                              </span>
                            )}
                            {item.product.price > 0 && (
                              <div className="text-right">
                                <p className="text-lg font-extrabold text-foreground">
                                  {(item.product.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {item.product.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT / unité
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Résumé panier */}
                <div className="bg-card rounded-xl border border-border/40 p-5">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={clearCart} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-sm font-medium cursor-pointer">
                      <Trash2 size={14} className="mr-2" /> Vider la sélection
                    </Button>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{totalItems} article{totalItems > 1 ? 's' : ''}</p>
                      {totalPrice > 0 && (
                        <p className="text-xl font-extrabold text-foreground">
                          Total estimé : {totalPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € <span className="text-sm font-normal text-muted-foreground">HT</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {totalPrice > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-3 text-right">
                      * Prix indicatif. Le devis définitif pourra varier selon les quantités et conditions de livraison.
                    </p>
                  )}
                </div>
              </div>

              {/* Formulaire B2B */}
              <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24">
                <div className="bg-card p-6 md:p-8 rounded-2xl border border-border/80 shadow-xl shadow-black/5">
                  <h2 className="font-heading text-2xl mb-2">Vos coordonnées</h2>
                  <p className="text-muted-foreground text-sm mb-6">Pour recevoir votre devis personnalisé.</p>

                  {error && (
                    <div role="alert" className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label htmlFor="devis-entity" className="text-sm font-semibold flex items-center gap-2"><Building2 size={15} /> Collectivité / Entreprise <span className="text-destructive">*</span></label>
                      <Input id="devis-entity" name="entity" required aria-required="true" placeholder="Ex: Mairie de Perpignan" className="bg-muted/20 border-border/80 h-11 rounded-xl" />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="devis-contactName" className="text-sm font-semibold flex items-center gap-2"><User size={15} /> Nom du contact <span className="text-destructive">*</span></label>
                      <Input id="devis-contactName" name="contactName" required aria-required="true" placeholder="Jean Dupont" className="bg-muted/20 border-border/80 h-11 rounded-xl" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label htmlFor="devis-email" className="text-sm font-semibold flex items-center gap-2"><Mail size={15} /> Email <span className="text-destructive">*</span></label>
                        <Input id="devis-email" name="email" type="email" required aria-required="true" placeholder="contact@mairie.fr" className="bg-muted/20 border-border/80 h-11 rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="devis-phone" className="text-sm font-semibold flex items-center gap-2"><Phone size={15} /> Téléphone <span className="text-destructive">*</span></label>
                        <Input id="devis-phone" name="phone" type="tel" required aria-required="true" placeholder="04 68 00 00 00" className="bg-muted/20 border-border/80 h-11 rounded-xl" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="devis-message" className="text-sm font-semibold">Message (optionnel)</label>
                      <textarea
                        id="devis-message"
                        name="message"
                        rows={3}
                        className="flex w-full rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all resize-none"
                        placeholder="Contraintes de livraison, délais..."
                      />
                    </div>

                    {/* Récap rapide */}
                    <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                      <p className="text-sm font-semibold mb-2">Récapitulatif</p>
                      <div className="space-y-1 text-sm">
                        {items.map((item) => (
                          <div key={item.product.id} className="flex justify-between text-muted-foreground">
                            <span className="truncate mr-2">{item.product.name}</span>
                            <span className="flex-shrink-0 font-medium">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      {totalPrice > 0 && (
                        <div className="flex justify-between mt-3 pt-3 border-t border-primary/10 font-bold text-sm">
                          <span>Total estimé HT</span>
                          <span>{totalPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                        </div>
                      )}
                      {items.some(item => item.variantDelai) && (() => {
                        const delais = [...new Set(items.filter(i => i.variantDelai).map(i => i.variantDelai!))]
                        const formatDelai = (d: string) => /^\d+$/.test(d) ? `${d} semaines` : d
                        return (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/10 text-sm text-muted-foreground">
                            <Clock size={14} className="text-accent flex-shrink-0" />
                            <span>Délai de livraison : <strong className="text-foreground">{delais.map(formatDelai).join(', ')}</strong></span>
                          </div>
                        )
                      })()}
                    </div>

                    <Button
                      type="submit"
                      className="btn-fill w-full h-14 rounded-xl font-bold text-base cursor-pointer hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98]"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="h-5 w-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin mr-2" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>Envoyer ma demande de devis <Send size={18} className="ml-2" /></>
                      )}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center mt-3 uppercase tracking-wide opacity-70">
                      Devis gratuit et sans engagement
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </AnimatedSection>
        )}
      </div>
    </div>
  );
}
