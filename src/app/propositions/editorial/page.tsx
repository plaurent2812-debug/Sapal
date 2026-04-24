"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useSpring } from "motion/react";
import { ArrowUpRight, ArrowLeft } from "lucide-react";

const products = [
  {
    num: "Nº 01",
    family: "Potelet · Ductile",
    title: "Le Rennes, en fonte patinée",
    ref: "208104",
    image: "/products/208104.jpg",
    caption:
      "Coulé d'une pièce, verrouillage par goupille interne. Trois coloris patinés atelier.",
  },
  {
    num: "Nº 02",
    family: "Abri voyageurs",
    title: "Canopée aluminium — Lumina",
    ref: "aires-de-jeux",
    image: "/products/abris-et-cycles.webp",
    caption:
      "Ossature aluminium laqué, bardage polycarbonate translucide. Quatre longueurs standard.",
  },
  {
    num: "Nº 03",
    family: "Corbeille perforée",
    title: "Diamant, 60 litres",
    ref: "208104",
    image: "/products/208104.jpg",
    caption: "Tôle d'acier perforée losange, peinture thermolaquée RAL 7016.",
  },
  {
    num: "Nº 04",
    family: "Barrière de ville",
    title: "Ville de Pierre — 2 m",
    ref: "200060",
    image: "/products/200060.jpg",
    caption: "Acier galvanisé à chaud, pieds à sceller ou sur platine vissée.",
  },
];

export default function EditorialPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 20, mass: 0.4 });
  const progressWidth = useTransform(smooth, [0, 1], ["0%", "100%"]);
  const heroImageY = useTransform(smooth, [0, 0.25], ["0%", "-18%"]);
  const heroTextY = useTransform(smooth, [0, 0.25], ["0%", "8%"]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen w-full bg-[#efe8dc] text-[#1a1612] selection:bg-[#b5683a] selection:text-[#efe8dc]"
      style={{ fontFamily: "var(--font-archivo)" }}
    >
      {/* Progress bar */}
      <motion.div
        className="fixed left-0 top-0 z-50 h-px bg-[#1a1612] origin-left"
        style={{ width: progressWidth }}
      />

      {/* Top meta strip */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-[#1a1612]/8 bg-[#efe8dc]/90 px-6 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] backdrop-blur-md sm:px-10">
        <Link
          href="/propositions"
          className="flex items-center gap-2 opacity-60 transition-opacity hover:opacity-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Index
        </Link>
        <span className="hidden sm:inline opacity-60">
          Édition Avril 2026 · Nº 1 · Volume I
        </span>
        <span className="opacity-60">SAPAL — Édition Cannes</span>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-[#1a1612]/10 px-6 py-20 sm:px-10 sm:py-32 lg:py-40">
        <motion.div style={{ y: heroTextY }} className="relative z-10 max-w-[80ch]">
          <p className="mb-8 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[#b5683a]">
            — Avant-propos
          </p>
          <h1
            className="font-[family-name:var(--font-display)] text-[clamp(3rem,9vw,9rem)] font-[380] leading-[0.9] tracking-[-0.035em]"
            style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 60" }}
          >
            L'objet public,
            <br />
            <em className="font-[440] italic text-[#b5683a]">
              considéré comme
            </em>
            <br />
            une pièce d'auteur.
          </h1>
          <p className="mt-10 max-w-xl text-base leading-[1.7] text-[#1a1612]/75 sm:text-lg">
            Depuis plus de trente ans, SAPAL Signalisation équipe les places et les boulevards
            de la Côte d'Azur. Nous choisissons chaque référence comme un libraire choisit
            un ouvrage&nbsp;: pour sa matière, sa tenue, sa probité.
          </p>
        </motion.div>

        {/* Hero image — collection still life */}
        <motion.figure
          style={{ y: heroImageY }}
          className="relative z-0 mx-auto mt-16 aspect-[16/9] w-full max-w-6xl overflow-hidden rounded-sm bg-[#e4dccc]"
        >
          <Image
            src="/products/abris-et-cycles.webp"
            alt="Abri voyageurs aluminium SAPAL"
            fill
            sizes="(min-width: 1280px) 1200px, 100vw"
            className="object-contain object-center mix-blend-multiply"
            priority
          />
          <figcaption className="absolute bottom-4 left-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[#1a1612]/50">
            Fig. 01 — Canopée Lumina, aluminium laqué RAL 7016
          </figcaption>
        </motion.figure>

        {/* Ligne décorative */}
        <div aria-hidden className="pointer-events-none absolute left-6 top-20 hidden font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#1a1612]/40 sm:block">
          <span className="block rotate-180 [writing-mode:vertical-rl]">
            I — Édition Côte d'Azur · Cannes La Bocca
          </span>
        </div>
      </section>

      {/* MANIFESTO — split */}
      <section className="border-b border-[#1a1612]/10 px-6 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12">
          <aside className="lg:col-span-4">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.24em] text-[#b5683a]">
              Manifeste · Chap. I
            </p>
            <h2
              className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-[-0.03em]"
              style={{ fontVariationSettings: "'opsz' 96" }}
            >
              On ne vend pas
              <br />
              <em className="italic text-[#b5683a]">du mobilier</em>.
            </h2>
          </aside>

          <div className="space-y-8 text-lg leading-[1.8] text-[#1a1612]/85 lg:col-span-7 lg:col-start-6">
            <p>
              Ce qui atterrit dans une rue y reste trente ans. Une barrière, un banc, une
              corbeille&nbsp;: ces objets portent le poids du quotidien, le vandalisme, le sel
              marin, la nuit. Il ne suffit pas qu'ils soient catalogués — ils doivent
              <em className="not-italic font-medium"> mériter </em>leur place.
            </p>
            <p>
              Nos acheteurs parcourent les usines, refusent des lots, imposent des traitements.
              C'est lent. C'est méthodique. C'est pourquoi les communes reviennent.
            </p>
            <p className="border-l-2 border-[#b5683a] pl-6 font-[family-name:var(--font-display)] text-xl italic leading-[1.5] text-[#1a1612]">
              « Une ville se lit dans ses poteaux avant de se lire dans ses façades. »
              <span className="mt-2 block font-[family-name:var(--font-mono)] text-[11px] not-italic uppercase tracking-[0.2em] text-[#1a1612]/50">
                — N. Bertone, SAPAL, 2018
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* COLLECTION — pieces numérotées */}
      <section className="border-b border-[#1a1612]/10 px-6 py-24 sm:px-10 sm:py-32">
        <header className="mx-auto mb-16 flex max-w-6xl flex-col gap-2 sm:mb-24 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.24em] text-[#b5683a]">
              Collection · Printemps-Été 2026
            </p>
            <h2
              className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-[-0.03em] sm:text-7xl"
              style={{ fontVariationSettings: "'opsz' 120" }}
            >
              Quatre pièces,
              <br />
              <em className="italic text-[#b5683a]">quatre partis pris</em>.
            </h2>
          </div>
          <Link
            href="#"
            className="group inline-flex shrink-0 items-center gap-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.22em] text-[#1a1612]/70 transition-colors hover:text-[#1a1612]"
          >
            Catalogue complet
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </header>

        <ol className="mx-auto max-w-6xl">
          {products.map((p, i) => (
            <li
              key={i}
              className="group grid items-center gap-6 border-t border-[#1a1612]/12 py-10 first:border-t sm:py-14 lg:grid-cols-12 lg:gap-10"
            >
              <div className="flex items-center gap-6 lg:col-span-3">
                <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.22em] text-[#b5683a]">
                  {p.num}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-[#1a1612]/50">
                  Réf. {p.ref}
                </span>
              </div>
              <div className="lg:col-span-5">
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-[#1a1612]/50">
                  {p.family}
                </p>
                <h3
                  className="mt-2 font-[family-name:var(--font-display)] text-3xl leading-[1.05] tracking-[-0.02em] sm:text-4xl"
                  style={{ fontVariationSettings: "'opsz' 72" }}
                >
                  {p.title}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-[1.7] text-[#1a1612]/75">
                  {p.caption}
                </p>
              </div>
              <figure className="relative aspect-[4/3] w-full overflow-hidden rounded-sm bg-[#e4dccc] lg:col-span-4">
                <Image
                  src={p.image}
                  alt={p.title}
                  fill
                  sizes="(min-width: 1024px) 400px, 100vw"
                  className="object-contain object-center p-4 mix-blend-multiply transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                />
              </figure>
            </li>
          ))}
        </ol>
      </section>

      {/* ATELIER — quotes & horaires */}
      <section className="relative overflow-hidden bg-[#1a1612] px-6 py-24 text-[#efe8dc] sm:px-10 sm:py-32">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.24em] text-[#b5683a]">
              Atelier · 260 Av. Michel Jourdan
            </p>
            <h2
              className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-[0.92] tracking-[-0.03em] sm:text-7xl"
              style={{ fontVariationSettings: "'opsz' 120" }}
            >
              Venez voir
              <br />
              <em className="italic text-[#b5683a]">avant d'acheter</em>.
            </h2>
            <p className="mt-8 max-w-md text-lg leading-[1.7] text-[#efe8dc]/75">
              Notre atelier à Cannes La Bocca accueille les services techniques et
              bureaux d'études. Prenez rendez-vous pour manipuler, comparer, peser.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/contact"
                className="group inline-flex items-center gap-3 rounded-full bg-[#b5683a] px-7 py-3.5 text-sm font-[500] text-[#efe8dc] transition-transform hover:-translate-y-0.5"
              >
                Prendre rendez-vous
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/catalogue"
                className="text-sm font-[500] underline decoration-[#b5683a] decoration-1 underline-offset-[6px] transition-opacity hover:opacity-70"
              >
                Feuilleter le catalogue
              </Link>
            </div>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <dl className="space-y-6 border-l border-[#efe8dc]/15 pl-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#efe8dc]/70">
              <div>
                <dt className="text-[#b5683a]">— Horaires</dt>
                <dd className="mt-2 normal-case tracking-normal text-[#efe8dc]/85 text-sm">
                  Lun–Ven · 8h30 — 17h30
                </dd>
              </div>
              <div>
                <dt className="text-[#b5683a]">— Téléphone</dt>
                <dd className="mt-2 normal-case tracking-normal text-[#efe8dc]/85 text-sm">
                  06 22 90 28 54
                </dd>
              </div>
              <div>
                <dt className="text-[#b5683a]">— Courrier</dt>
                <dd className="mt-2 normal-case tracking-normal text-[#efe8dc]/85 text-sm">
                  societe@sapal.fr
                </dd>
              </div>
              <div>
                <dt className="text-[#b5683a]">— Adresse</dt>
                <dd className="mt-2 normal-case tracking-normal text-[#efe8dc]/85 text-sm leading-[1.6]">
                  260 Av. Michel Jourdan
                  <br />
                  06150 Cannes
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* decorative large type */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 left-0 right-0 select-none font-[family-name:var(--font-display)] text-[22vw] italic leading-none tracking-[-0.04em] text-[#efe8dc]/[0.04] sm:-bottom-20"
          style={{ fontVariationSettings: "'opsz' 144" }}
        >
          SAPAL
        </div>
      </section>

      {/* COLOPHON */}
      <footer className="px-6 py-12 text-xs text-[#1a1612]/60 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-[#1a1612]/15 pt-6 font-[family-name:var(--font-mono)] uppercase tracking-[0.2em] sm:flex-row sm:items-center sm:justify-between">
          <span>Direction éditoriale · SAPAL Signalisation</span>
          <span>Cannes · MMXXVI</span>
        </div>
      </footer>
    </div>
  );
}
