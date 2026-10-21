"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ReactLenis } from "lenis/react";
import type { LenisRef } from "lenis/react";
import type Lenis from "lenis";
import { ensureGsap, gsap, ScrollTrigger } from "./gsap-setup";

let lenisInstance: Lenis | null = null;

/**
 * Smooth-scrolls to a `#anchor` target via the global Lenis instance.
 * Falls back to native smooth scrollIntoView when Lenis isn't mounted.
 */
export function scrollToId(id: string): void {
  const target = id.startsWith("#") ? id : `#${id}`;
  const lenis = lenisInstance;
  if (lenis) {
    lenis.scrollTo(target, { offset: -80 });
    return;
  }
  const el = document.querySelector(target);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

interface SmoothScrollProps {
  children: ReactNode;
}

/**
 * Root-level smooth scroll: drives Lenis from the GSAP ticker so
 * ScrollTrigger stays in sync. Renders children directly (no Lenis at all)
 * when the user prefers reduced motion.
 */
export default function SmoothScroll({ children }: SmoothScrollProps) {
  const [enabled] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const ref = useRef<LenisRef | null>(null);

  useEffect(() => {
    if (!enabled) return;
    ensureGsap();
    const lenis: Lenis | null | undefined = ref.current?.lenis;
    if (!lenis) return;
    lenisInstance = lenis;

    // Sync Lenis with the GSAP ticker.
    const offScroll = lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number): void => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Delegate anchor clicks to Lenis with a fixed-header offset.
    const onClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      if (!document.querySelector(href)) return;
      event.preventDefault();
      lenis.scrollTo(href, { offset: -80 });
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(raf);
      offScroll();
      if (lenisInstance === lenis) lenisInstance = null;
    };
  }, [enabled]);

  if (!enabled) return <>{children}</>;

  return (
    <ReactLenis root ref={ref} options={{ autoRaf: false }}>
      {children}
    </ReactLenis>
  );
}
