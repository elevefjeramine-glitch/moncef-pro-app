"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ensureGsap, gsap, EASE_LUXE } from "./gsap-setup";
import { isWeakDevice } from "../three/gpu";

export type RevealVariant = "mask" | "fade-up" | "parallax";
export type RevealTag = "div" | "section" | "h2" | "p" | "span";

export interface RevealProps {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  className?: string;
  as?: RevealTag;
}

/**
 * Scroll-driven reveal. Always uses fromTo (never from()) so the resting
 * state stays visible even if a trigger never fires. Renders children
 * unanimated when the user prefers reduced motion.
 */
export default function Reveal({
  children,
  variant = "fade-up",
  delay = 0,
  className,
  as = "div",
}: RevealProps) {
  const Tag = as;
  const [reduced, setReduced] = useState<boolean>(false);
  const outerRef = useRef<HTMLElement | null>(null);
  const innerRef = useRef<HTMLElement | null>(null);
  // Blur reveals force full repaints: on weak devices use transform/opacity only.
  const cheapFx = useMemo(() => isWeakDevice(), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent): void => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    ensureGsap();
    const el = outerRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      if (variant === "mask") {
        const inner = innerRef.current;
        if (!inner) return;
        gsap.fromTo(
          inner,
          { yPercent: 110 },
          {
            yPercent: 0,
            duration: 1.1,
            ease: EASE_LUXE,
            delay,
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          },
        );
      } else if (variant === "fade-up") {
        gsap.fromTo(
          el,
          cheapFx ? { opacity: 0, y: 24 } : { opacity: 0, y: 40, filter: "blur(8px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: cheapFx ? 0.7 : 0.9,
            ease: EASE_LUXE,
            delay,
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none reverse",
            },
          },
        );
      } else {
        gsap.fromTo(
          el,
          { yPercent: -10 },
          {
            yPercent: 10,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          },
        );
      }
    });

    return () => ctx.revert();
  }, [variant, delay, reduced, cheapFx]);

  // Callback refs typed on HTMLElement so one setter works for every `as` tag.
  const setOuter = (el: HTMLElement | null): void => {
    outerRef.current = el;
  };
  const setInner = (el: HTMLElement | null): void => {
    innerRef.current = el;
  };

  if (reduced) {
    return <Tag className={className}>{children}</Tag>;
  }

  if (variant === "mask") {
    return (
      <Tag ref={setOuter} className={className} style={{ overflow: "hidden" }}>
        <span ref={setInner} style={{ display: "block", willChange: "transform" }}>
          {children}
        </span>
      </Tag>
    );
  }

  return (
    <Tag ref={setOuter} className={className}>
      {children}
    </Tag>
  );
}
