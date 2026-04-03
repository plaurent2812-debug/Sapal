"use client";

import { useRef, useEffect, useState } from "react";

// ---- Hook: IntersectionObserver ----
function useInView(
  ref: React.RefObject<HTMLElement | null>,
  options: { once?: boolean; margin?: string } = {}
) {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (options.once !== false) observer.disconnect();
        } else if (options.once === false) {
          setIsInView(false);
        }
      },
      { rootMargin: options.margin ?? "0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, options.once, options.margin]);

  return isInView;
}

// ---- Keyframes (injected once) ----
const cssInjectedRef = { current: false };

function InjectMotionStyles() {
  if (cssInjectedRef.current) return null;
  cssInjectedRef.current = true;

  return (
    <style jsx global>{`
      @keyframes motion-fade-up {
        from { opacity: 0; transform: translateY(40px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes motion-fade-left {
        from { opacity: 0; transform: translateX(-40px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes motion-fade-right {
        from { opacity: 0; transform: translateX(40px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes motion-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes motion-item-fade-up {
        from { opacity: 0; transform: translateY(30px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes motion-parallax-in {
        from { opacity: 0; transform: translateY(30px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .motion-hidden {
        opacity: 0;
      }
      .motion-animate-up {
        animation: motion-fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .motion-animate-left {
        animation: motion-fade-left 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .motion-animate-right {
        animation: motion-fade-right 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .motion-animate-none {
        animation: motion-fade-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .motion-animate-item {
        animation: motion-item-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .motion-animate-parallax {
        animation: motion-parallax-in 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
    `}</style>
  );
}

// ---- AnimatedSection ----
export function AnimatedSection({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const animClass = isInView ? `motion-animate-${direction}` : "motion-hidden";

  return (
    <>
      <InjectMotionStyles />
      <div
        ref={ref}
        className={`${animClass} ${className}`}
        style={isInView ? { animationDelay: delay + "s" } : undefined}
      >
        {children}
      </div>
    </>
  );
}

// ---- AnimatedItem ----
export function AnimatedItem({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  const animClass = isInView ? "motion-animate-item" : "motion-hidden";

  return (
    <>
      <InjectMotionStyles />
      <div
        ref={ref}
        className={`${animClass} ${className}`}
        style={isInView ? { animationDelay: delay + "s" } : undefined}
      >
        {children}
      </div>
    </>
  );
}

// ---- AnimatedCounter (inchangé — n'utilisait déjà pas framer-motion pour l'animation) ----
export function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  className = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const duration = 1500;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, value]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {count.toLocaleString("fr-FR")}
      {suffix}
    </span>
  );
}

// ---- HoverCard ----
export function HoverCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`hover:-translate-y-1.5 transition-transform duration-300 ${className}`}>
      {children}
    </div>
  );
}

// ---- ScaleOnHover ----
export function ScaleOnHover({
  children,
  className = "",
  scale = 1.03,
}: {
  children: React.ReactNode;
  className?: string;
  scale?: number;
}) {
  return (
    <div
      className={`hover:scale-[1.03] active:scale-[0.98] transition-transform duration-200 ${className}`}
    >
      {children}
    </div>
  );
}

// ---- ParallaxSection ----
export function ParallaxSection({
  children,
  className = "",
  offset = 50,
}: {
  children: React.ReactNode;
  className?: string;
  offset?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, margin: "100px" });

  const animClass = isInView ? "motion-animate-parallax" : "motion-hidden";

  return (
    <>
      <InjectMotionStyles />
      <div
        ref={ref}
        className={`${animClass} ${className}`}
      >
        {children}
      </div>
    </>
  );
}
