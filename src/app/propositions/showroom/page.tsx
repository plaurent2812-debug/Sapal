"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "motion/react";
import { ArrowUpRight, ArrowLeft, Plus } from "lucide-react";

const specs = [
  {
    code: "SPL-208104",
    family: "Mobilier urbain",
    title: "Potelet ductile Rennes",
    image: "/products/208104.jpg",
    meta: [
      { k: "Matière", v: "Fonte ductile GJS 500-7" },
      { k: "Hauteur", v: "1 030 mm" },
      { k: "Ø hors-tout", v: "140 mm" },
      { k: "Scellement", v: "Goujon M16 · platine" },
      { k: "Finition", v: "Thermolaqué RAL 7016" },
    ],
  },
  {
    code: "SPL-ABR-LUM",
    family: "Abri voyageurs",
    title: "Canopée Lumina",
    image: "/products/abris-et-cycles.webp",
    meta: [
      { k: "Structure", v: "Alu 6060-T6 laqué" },
      { k: "Longueurs", v: "3 · 4 · 5 · 6 m" },
      { k: "Bardage", v: "Polycarbonate 10 mm" },
      { k: "Vent", v: "Cl. 3 — EN 13200-6" },
      { k: "Assises", v: "Option banc 3/4/5 pl." },
    ],
  },
  {
    code: "SPL-200060",
    family: "Sécurisation",
    title: "Barrière Ville de Pierre",
    image: "/products/200060.jpg",
    meta: [
      { k: "Matière", v: "Tube acier Ø 40/33 mm" },
      { k: "Longueur", v: "2 000 mm" },
      { k: "Hauteur utile", v: "1 100 mm" },
      { k: "Traitement", v: "Galva à chaud NF EN ISO 1461" },
      { k: "Fixation", v: "Pieds à sceller ou platine" },
    ],
  },
  {
    code: "SPL-204371",
    family: "Jalonnement",
    title: "Potelet Chaîne Azur",
    image: "/products/204371.jpg",
    meta: [
      { k: "Matière", v: "Tube acier Ø 80 mm" },
      { k: "Chaîne", v: "Maillon 6 mm PVC bleu" },
      { k: "Hauteur", v: "800 mm hors sol" },
      { k: "Finition", v: "Thermolaqué RAL 5010" },
      { k: "Options", v: "Tête boule, anneaux Ø 50" },
    ],
  },
];

const navLinks = [
  { label: "Manifeste", href: "#manifeste" },
  { label: "Showroom", href: "#showroom" },
  { label: "Territoire", href: "#territoire" },
  { label: "Contact", href: "#contact" },
];

function useCountUp(to: number, active: boolean, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, active, duration]);
  return val;
}

export default function ShowroomPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const smooth = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const progressX = useTransform(smooth, [0, 1], ["-100%", "0%"]);
  const heroGridY = useTransform(smooth, [0, 0.3], ["0%", "-14%"]);
  const heroLabelX = useTransform(smooth, [0, 0.3], [0, -60]);

  const [active, setActive] = useState(0);

  // showroom scroll-pin mechanic: index follows scroll progress in the pinned section
  const showroomRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: showroomProgress } = useScroll({
    target: showroomRef,
    offset: ["start start", "end end"],
  });
  // We use onChange to sync active index without re-rendering whole tree
  const smoothProg = useSpring(showroomProgress, { stiffness: 80, damping: 20 });
  smoothProg.on?.("change", (v: number) => {
    const idx = Math.min(specs.length - 1, Math.floor(v * specs.length));
    setActive((curr) => (curr === idx ? curr : idx));
  });

  const refsCount = useCountUp(1247, true);
  const yearsCount = useCountUp(33, true);
  const deptCount = useCountUp(96, true);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen w-full bg-[#0e0e0e] text-neutral-100 selection:bg-[#c6ff3a] selection:text-[#0e0e0e]"
      style={{ fontFamily: "var(--font-archivo)" }}
    >
      {/* Progress bar (fixed top) */}
      <motion.div
        className="fixed left-0 right-0 top-0 z-50 h-[2px] bg-[#c6ff3a] origin-left"
        style={{ transform: `translateX(var(--p, 0))`, x: progressX }}
      />

      {/* Grain / noise overlay via SVG dataURI */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.8'/></svg>\")",
        }}
      />

      {/* NAV */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0e0e0e]/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] sm:px-10">
          <Link
            href="/propositions"
            className="flex items-center gap-2 text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Index
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((n) => (
              <a key={n.href} href={n.href} className="text-white/60 transition-colors hover:text-[#c6ff3a]">
                {n.label}
              </a>
            ))}
          </nav>
          <a
            href="#contact"
            className="flex items-center gap-2 rounded-full bg-[#c6ff3a] px-4 py-1.5 text-[#0e0e0e] transition-transform hover:-translate-y-0.5"
          >
            Demander un devis <Plus className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/8 px-6 pt-20 pb-0 sm:px-10 sm:pt-28 lg:pt-36">
        {/* Corner tags */}
        <div className="absolute left-6 top-6 flex flex-col gap-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-white/40 sm:left-10 sm:top-10">
          <span>— 43.5499° N</span>
          <span>— 07.0128° E</span>
          <span>— Cannes · FR</span>
        </div>
        <motion.div
          style={{ x: heroLabelX }}
          className="absolute right-6 top-6 flex flex-col items-end gap-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#c6ff3a]/80 sm:right-10 sm:top-10"
        >
          <span>Rev. 2026-04 · Build A</span>
          <span>— Showroom / 001</span>
        </motion.div>

        <div className="mx-auto grid max-w-7xl gap-10 pt-20 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <p className="mb-6 flex items-center gap-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[#c6ff3a]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c6ff3a]" />
              Fournisseur B2B · Marchés publics
            </p>
            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="font-[family-name:var(--font-archivo)] font-black text-[clamp(3rem,11vw,10rem)] leading-[0.82] tracking-[-0.045em] uppercase"
            >
              Équiper
              <br />
              la voirie,
              <br />
              <span className="text-[#c6ff3a]">au millimètre</span>.
            </motion.h1>
          </div>
          <div className="flex flex-col justify-end gap-6 text-sm leading-[1.7] text-white/70 lg:col-span-4">
            <p>
              SAPAL Signalisation fournit les collectivités françaises en mobilier urbain,
              signalétique et équipements de voirie. Depuis notre atelier de Cannes La Bocca,
              nous livrons dans toute la France sous 48 à 72 heures.
            </p>
            <div className="flex gap-3">
              <a
                href="#showroom"
                className="group inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm transition-colors hover:border-[#c6ff3a] hover:text-[#c6ff3a]"
              >
                Explorer le showroom
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Hero image band */}
        <motion.div
          style={{ y: heroGridY }}
          className="relative mx-auto mt-16 grid max-w-7xl grid-cols-6 gap-2 pb-20 sm:gap-3"
        >
          <figure className="col-span-3 aspect-[4/5] overflow-hidden rounded bg-[#171717] sm:col-span-2">
            <Image
              src="/products/204371.jpg"
              alt="Potelet chaîne"
              width={600}
              height={750}
              className="h-full w-full object-contain p-6"
            />
          </figure>
          <figure className="relative col-span-3 aspect-[4/5] overflow-hidden rounded bg-[#171717] sm:col-span-3">
            <Image
              src="/products/abris-et-cycles.webp"
              alt="Abri voyageurs"
              width={900}
              height={700}
              className="h-full w-full object-contain p-6"
            />
            <figcaption className="absolute bottom-3 left-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-white/50">
              SPL-ABR-LUM
            </figcaption>
          </figure>
          <figure className="col-span-6 aspect-[2/1] overflow-hidden rounded bg-[#171717] sm:col-span-1 sm:aspect-[4/5]">
            <Image
              src="/products/200060.jpg"
              alt="Barrière"
              width={400}
              height={500}
              className="h-full w-full object-contain p-4"
            />
          </figure>
        </motion.div>
      </section>

      {/* STATS strip */}
      <section id="manifeste" className="border-b border-white/8 px-6 py-16 sm:px-10">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 sm:grid-cols-4">
          {[
            { k: "Références en stock", v: refsCount, suffix: "" },
            { k: "Années d'exercice", v: yearsCount, suffix: "" },
            { k: "Départements livrés", v: deptCount, suffix: "" },
            { k: "Délai devis garanti", v: 3, suffix: " h" },
          ].map((s, i) => (
            <div key={i} className="border-l border-white/15 pl-5">
              <div className="font-[family-name:var(--font-archivo)] font-black text-4xl leading-none tracking-tight sm:text-6xl">
                {s.v.toLocaleString("fr-FR")}
                <span className="text-[#c6ff3a]">{s.suffix}</span>
              </div>
              <div className="mt-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-white/50">
                {s.k}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SHOWROOM PINNED */}
      <section id="showroom" ref={showroomRef} className="relative" style={{ height: `${specs.length * 110}vh` }}>
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden border-b border-white/8">
          {/* top meta */}
          <div className="flex items-center justify-between border-b border-white/8 bg-[#0e0e0e]/90 px-6 py-4 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-white/50 sm:px-10">
            <span>— Showroom · {String(active + 1).padStart(2, "0")} / {String(specs.length).padStart(2, "0")}</span>
            <span className="text-[#c6ff3a]">{specs[active].code}</span>
            <span className="hidden sm:inline">Scroll pour changer de pièce →</span>
          </div>

          <div className="relative grid flex-1 grid-cols-1 lg:grid-cols-12">
            {/* image */}
            <div className="relative col-span-1 overflow-hidden border-r border-white/8 bg-gradient-to-br from-[#1a1a1a] to-[#0e0e0e] lg:col-span-7">
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                  backgroundSize: "48px 48px",
                }}
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={specs[active].code}
                  initial={{ opacity: 0, scale: 0.95, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.02, y: -20 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 flex items-center justify-center p-10 sm:p-16"
                >
                  <Image
                    src={specs[active].image}
                    alt={specs[active].title}
                    width={900}
                    height={900}
                    className="max-h-full max-w-full object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)]"
                  />
                </motion.div>
              </AnimatePresence>

              {/* corners */}
              {["top-4 left-4", "top-4 right-4", "bottom-4 left-4", "bottom-4 right-4"].map((c, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={`absolute ${c} h-3 w-3 border-[#c6ff3a]/60 ${
                    i === 0
                      ? "border-t border-l"
                      : i === 1
                      ? "border-t border-r"
                      : i === 2
                      ? "border-b border-l"
                      : "border-b border-r"
                  }`}
                />
              ))}

              {/* giant index */}
              <AnimatePresence mode="wait">
                <motion.span
                  key={`num-${active}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  aria-hidden
                  className="pointer-events-none absolute bottom-4 left-6 font-[family-name:var(--font-archivo)] text-[clamp(4rem,14vw,14rem)] font-black leading-none tracking-[-0.06em] text-white/[0.06] sm:bottom-6 sm:left-10"
                >
                  {String(active + 1).padStart(2, "0")}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* specs */}
            <div className="col-span-1 flex flex-col overflow-hidden bg-[#0e0e0e] lg:col-span-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`spec-${specs[active].code}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex h-full flex-col justify-between px-8 py-10 sm:px-12 sm:py-14"
                >
                  <div>
                    <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[#c6ff3a]">
                      {specs[active].family}
                    </p>
                    <h3 className="mt-5 font-[family-name:var(--font-archivo)] text-4xl font-black uppercase leading-[0.95] tracking-[-0.035em] sm:text-5xl">
                      {specs[active].title}
                    </h3>

                    <dl className="mt-10 divide-y divide-white/10 border-y border-white/10 font-[family-name:var(--font-mono)] text-[12px]">
                      {specs[active].meta.map((m, i) => (
                        <div key={i} className="flex items-start justify-between gap-6 py-3.5">
                          <dt className="uppercase tracking-[0.18em] text-white/50">{m.k}</dt>
                          <dd className="text-right text-white/90">{m.v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="mt-10 flex items-center gap-3">
                    <Link
                      href="/contact"
                      className="group inline-flex items-center gap-2 rounded-full bg-[#c6ff3a] px-5 py-2.5 text-sm font-medium text-[#0e0e0e] transition-transform hover:-translate-y-0.5"
                    >
                      Demander cette référence
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                    <Link href="/catalogue" className="text-sm text-white/60 underline underline-offset-4 hover:text-white">
                      Fiche complète
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* bottom stepper */}
          <div className="flex items-stretch border-t border-white/8 bg-[#0e0e0e]">
            {specs.map((s, i) => (
              <button
                key={s.code}
                onClick={() => {
                  // jump scroll within pinned section
                  const el = showroomRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  const total = el.offsetHeight - window.innerHeight;
                  const target = el.offsetTop + (i / specs.length) * total + 20;
                  window.scrollTo({ top: target, behavior: "smooth" });
                }}
                className={`relative flex-1 px-4 py-4 text-left font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] transition-colors sm:px-6 ${
                  active === i
                    ? "bg-[#c6ff3a] text-[#0e0e0e]"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <span className="block opacity-70">— {String(i + 1).padStart(2, "0")}</span>
                <span className="mt-1 block truncate text-xs normal-case tracking-normal">
                  {s.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* TERRITOIRE */}
      <section
        id="territoire"
        className="relative overflow-hidden border-b border-white/8 px-6 py-24 sm:px-10 sm:py-32"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[#c6ff3a]">
              — Territoire
            </p>
            <h2 className="mt-5 font-[family-name:var(--font-archivo)] font-black text-5xl uppercase leading-[0.9] tracking-[-0.035em] sm:text-7xl">
              Base Cannes.
              <br />
              Livraison France.
            </h2>
            <p className="mt-8 max-w-md text-base leading-[1.7] text-white/70">
              Atelier et stock à Cannes La Bocca. Nous intervenons en priorité sur la Côte
              d'Azur et livrons les 96 départements via transporteur dédié.
            </p>
          </div>
          <div className="lg:col-span-6">
            <div
              className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-[#111]"
              aria-label="Carte stylisée du territoire"
            >
              {/* grid */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              {/* "France" blob */}
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 400 300"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M200 40 C 140 50, 90 80, 80 130 C 70 180, 95 220, 140 240 C 175 255, 225 260, 260 245 C 300 230, 320 195, 315 160 C 315 110, 290 70, 245 50 C 230 42, 215 40, 200 40 Z"
                  className="stroke-white/30"
                  strokeWidth="1.5"
                  strokeDasharray="3 4"
                />
                <circle cx="285" cy="230" r="6" className="fill-[#c6ff3a]" />
                <circle cx="285" cy="230" r="14" className="fill-[#c6ff3a]/20">
                  <animate attributeName="r" values="10;24;10" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <text
                  x="295"
                  y="224"
                  className="fill-[#c6ff3a] font-mono"
                  fontSize="10"
                  letterSpacing="0.16em"
                >
                  CANNES · SAPAL
                </text>
                {[
                  [130, 80, "LILLE"],
                  [175, 115, "PARIS"],
                  [245, 120, "STRASBOURG"],
                  [160, 210, "BORDEAUX"],
                  [225, 215, "LYON"],
                  [200, 250, "MARSEILLE"],
                ].map(([x, y, label], i) => (
                  <g key={i}>
                    <circle cx={x as number} cy={y as number} r="2.5" className="fill-white/70" />
                    <text
                      x={(x as number) + 8}
                      y={(y as number) + 4}
                      className="fill-white/60 font-mono"
                      fontSize="8"
                      letterSpacing="0.18em"
                    >
                      {label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="border-b border-white/8 px-6 py-24 sm:px-10 sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[#c6ff3a]">
              — Contact
            </p>
            <h2 className="mt-5 font-[family-name:var(--font-archivo)] font-black text-5xl uppercase leading-[0.9] tracking-[-0.035em] sm:text-7xl">
              Un devis
              <br />
              sous <span className="text-[#c6ff3a]">trois heures</span>.
            </h2>
            <p className="mt-8 max-w-md text-base leading-[1.7] text-white/70">
              Envoyez-nous le cahier des charges ou la liste des références — nous revenons
              avec un devis chiffré et conforme Chorus Pro en moins de trois heures ouvrées.
            </p>
            <Link
              href="/contact"
              className="group mt-10 inline-flex items-center gap-3 rounded-full bg-[#c6ff3a] px-7 py-4 text-sm font-medium text-[#0e0e0e] transition-transform hover:-translate-y-0.5"
            >
              Démarrer le devis
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
          <dl className="lg:col-span-4 lg:col-start-9 space-y-6 border-l border-white/15 pl-6 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-white/70">
            <div>
              <dt className="text-[#c6ff3a]">— Téléphone</dt>
              <dd className="mt-2 normal-case tracking-normal text-white/90 text-sm">06 22 90 28 54</dd>
            </div>
            <div>
              <dt className="text-[#c6ff3a]">— Courriel</dt>
              <dd className="mt-2 normal-case tracking-normal text-white/90 text-sm">societe@sapal.fr</dd>
            </div>
            <div>
              <dt className="text-[#c6ff3a]">— Atelier</dt>
              <dd className="mt-2 normal-case tracking-normal text-white/90 text-sm leading-[1.6]">
                260 Av. Michel Jourdan
                <br />
                06150 Cannes · France
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* FOOTER meta */}
      <footer className="px-6 py-8 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-white/40 sm:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>SAPAL · Showroom build A</span>
          <span>MMXXVI · Cannes · FR</span>
        </div>
      </footer>
    </div>
  );
}
