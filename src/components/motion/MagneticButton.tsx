"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ensureGsap, gsap } from "./gsap-setup";

export interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
}

const RADIUS = 48;
const STRENGTH = 0.35;

/**
 * Magnetic wrapper: pulls its child toward the cursor with gsap.quickTo and
 * releases with a springy elastic on mouse leave. Only activates on fine
 * pointers without reduced motion; otherwise it's a plain wrapper.
 */
export default function MagneticButton({ children, className }: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer:fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ensureGsap();

    const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });

    const onMove = (event: MouseEvent): void => {
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      if (Math.hypot(dx, dy) < RADIUS * 2) {
        xTo(dx * STRENGTH);
        yTo(dy * STRENGTH);
      } else {
        xTo(0);
        yTo(0);
      }
    };

    const onLeave = (): void => {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      gsap.killTweensOf(el);
      gsap.set(el, { x: 0, y: 0 });
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ display: "inline-block" }}>
      {children}
    </div>
  );
}
