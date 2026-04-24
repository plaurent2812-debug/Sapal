import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const directions = [
  {
    slug: "editorial",
    index: "01",
    title: "Éditoriale",
    kicker: "Ivoire · Encre · Cuivre",
    pitch:
      "Nature morte photographique, typographie Fraunces, pagination de revue d'architecture. Le produit SAPAL traité comme pièce de collection.",
    tone: "Refined · Slow",
    preview: "bg-[#efe8dc] text-[#1a1612]",
  },
  {
    slug: "showroom",
    index: "02",
    title: "Showroom",
    kicker: "Ardoise · Lime · Grille",
    pitch:
      "Interface d'ingénierie, scroll-stack de produits, monospace technique, accent lime électrique. Positionne SAPAL en fournisseur-spec plutôt qu'en vendeur.",
    tone: "Precise · Technical",
    preview: "bg-[#141414] text-white",
  },
];

export default function PropositionsIndexPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <header className="mb-16 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
            Propositions · v3
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-[0.95] tracking-tight sm:text-6xl">
            Deux directions.<br />
            Deux manières de poser SAPAL.
          </h1>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-neutral-600">
          Vraies pages Next.js avec framer-motion et photos catalogue SAPAL — pas de mini-maquettes.
          Choisissez la direction, on décline le reste du site.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-2">
        {directions.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/propositions/${d.slug}`}
              className={`group relative block overflow-hidden rounded-2xl border border-black/5 ${d.preview} transition-transform duration-500 hover:-translate-y-1`}
            >
              <div className="flex aspect-[4/5] flex-col justify-between p-8 sm:aspect-[5/6] sm:p-10">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-xs tracking-[0.2em] opacity-60">
                    {d.index} / 02
                  </span>
                  <ArrowUpRight
                    className="h-5 w-5 opacity-60 transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:opacity-100"
                  />
                </div>

                <div>
                  <p className="mb-3 text-[11px] uppercase tracking-[0.22em] opacity-60">
                    {d.kicker}
                  </p>
                  <h2 className="font-[family-name:var(--font-display)] text-5xl leading-[0.9] tracking-tight sm:text-6xl">
                    {d.title}
                  </h2>
                  <p className="mt-5 max-w-sm text-sm leading-relaxed opacity-80">
                    {d.pitch}
                  </p>
                  <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] opacity-50">
                    — {d.tone}
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <footer className="mt-20 flex flex-col gap-2 border-t border-neutral-200 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <span>SAPAL Signalisation — propositions v3 · avril 2026</span>
        <span className="font-mono">/propositions/&#123;editorial|showroom&#125;</span>
      </footer>
    </main>
  );
}
