"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

/**
 * HeroSpotlight — halo lumineux qui suit le curseur, UNIQUEMENT dans le hero.
 * Desktop seulement : pointeur fin + hover, jamais sur tactile, jamais si
 * prefers-reduced-motion. Aucun re-render pendant le déplacement
 * (motion values framer-motion) et `pointer-events: none` : il ne capte
 * jamais un clic. Le halo s'éteint quand le curseur quitte le hero.
 */
export default function HeroSpotlight() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(-600);
  const my = useMotionValue(-600);
  const opacity = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 20, mass: 0.5 });
  const sy = useSpring(my, { stiffness: 120, damping: 20, mass: 0.5 });
  const so = useSpring(opacity, { stiffness: 120, damping: 20 });
  const background = useMotionTemplate`radial-gradient(340px circle at ${sx}px ${sy}px, rgba(89,130,255,0.16), rgba(0,210,182,0.08) 45%, transparent 70%)`;

  useEffect(() => {
    if (reduce) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    const hero = document.getElementById("hero");
    if (!hero) return;
    const onMove = (e: MouseEvent): void => {
      const r = hero.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) {
        opacity.set(0);
        return;
      }
      mx.set(e.clientX - r.left);
      my.set(e.clientY - r.top);
      opacity.set(1);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduce, mx, my, opacity]);

  if (reduce) return null;

  return (
    <motion.div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        opacity: so,
        background,
      }}
    />
  );
}
