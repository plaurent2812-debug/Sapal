export const metadata = {
  title: "Conditions Générales de Vente | SAPAL Signalisation",
  description: "Conditions générales de vente de SAPAL Signalisation.",
};

export default function CGVPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Hero */}
      <section className="relative w-full py-12 lg:py-16 bg-secondary/20 border-b border-border/50">
        <div className="container px-4 md:px-6 mx-auto">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Conditions Générales de Vente
          </h1>
          <p className="text-muted-foreground mt-2">
            Dernière mise à jour : mars 2026
          </p>
        </div>
      </section>

      <section className="container px-4 md:px-6 mx-auto py-12">
        <div className="prose prose-neutral dark:prose-invert max-w-3xl space-y-8">

          <div>
            <h2 className="text-xl font-bold mb-3">Article 1 - Objet</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les présentes conditions générales de vente (CGV) régissent l'ensemble des ventes de produits et services proposés par SAPAL Signalisation à ses clients professionnels et particuliers, via son site internet ou par tout autre moyen de commande.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">Article 2 - Prix</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les prix sont indiqués en euros hors taxes (HT). La TVA applicable est celle en vigueur au jour de la facturation. Les prix peuvent être modifiés à tout moment, mais les produits sont facturés au tarif en vigueur au moment de la validation de la commande. Un devis détaillé est établi préalablement à toute commande.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">Article 3 - Commandes</h2>
            <p className="text-muted-foreground leading-relaxed">
              Toute commande implique l'acceptation pleine et entière des présentes CGV. La commande n'est définitive qu'après confirmation écrite de SAPAL Signalisation et réception de l'acompte éventuel. Les demandes de devis effectuées via le site ne constituent pas un engagement de commande.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">Article 4 - Livraison</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les délais de livraison sont communiqués à titre indicatif lors de la validation de la commande. SAPAL Signalisation s'engage à faire ses meilleurs efforts pour respecter les délais annoncés. La livraison est effectuée à l'adresse indiquée par le client lors de la commande. Les frais de livraison sont précisés dans le devis.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">Article 5 - Paiement</h2>
            <p className="text-muted-foreground leading-relaxed">
              Le paiement s'effectue selon les modalités définies dans le devis ou la facture : virement bancaire, chèque ou mandat administratif pour les collectivités. Sauf accord particulier, le délai de paiement est de 30 jours à compter de la date de facturation. Tout retard de paiement entraîne l'application de pénalités de retard au taux légal en vigueur.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">Article 6 - Garantie</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les produits bénéficient de la garantie légale de conformité et de la garantie contre les vices cachés. La durée de garantie spécifique à chaque produit est indiquée sur la fiche produit correspondante. La garantie ne couvre pas l'usure normale, les dommages résultant d'une mauvaise utilisation ou d'un défaut d'entretien.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">Article 7 - Réclamations</h2>
            <p className="text-muted-foreground leading-relaxed">
              Toute réclamation relative à un défaut apparent ou une non-conformité doit être formulée par écrit dans un délai de 48 heures suivant la réception des marchandises. Passé ce délai, aucune réclamation ne sera recevable. Les réclamations doivent être adressées à societe@sapal.fr.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">Article 8 - Facturation électronique</h2>
            <p className="text-muted-foreground leading-relaxed">
              Conformément à la réglementation en vigueur, les factures destinées aux entités publiques sont déposées sur la plateforme Chorus Pro. Les clients concernés doivent communiquer leur numéro d'engagement et leur code service lors de la commande.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">Article 9 - Protection des données</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les données personnelles collectées sont traitées conformément au RGPD. Elles sont utilisées uniquement pour le traitement des commandes et la relation client. Le client dispose d'un droit d'accès, de rectification et de suppression de ses données en contactant societe@sapal.fr.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-3">Article 10 - Droit applicable</h2>
            <p className="text-muted-foreground leading-relaxed">
              Les présentes CGV sont soumises au droit français. En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, les tribunaux compétents seront ceux du siège social de SAPAL Signalisation.
            </p>
          </div>

        </div>
      </section>
    </div>
  );
}
