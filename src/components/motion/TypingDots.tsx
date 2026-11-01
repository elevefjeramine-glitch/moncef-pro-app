"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * TypingDots — indicateur de frappe « fondant » : trois points qui gonflent
 * et s'estompent en cascade, avec un halo flou derrière eux (effet de fusion).
 * Rendu statique si prefers-reduced-motion.
 */
export default function TypingDots() {
  const reduce = useReducedMotion();
  const dots = [0, 1, 2];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        filter: "blur(0.2px)",
      }}
      aria-label="En train d'écrire"
    >
      {dots.map((i) => (
        <motion.span
          key={i}
          animate={
            reduce
              ? { scale: 1, opacity: 0.7 }
              : { scale: [1, 1.45, 1], opacity: [0.35, 1, 0.35] }
          }
          transition={
            reduce
              ? { duration: 0 }
              : { repeat: Infinity, duration: 0.9, delay: i * 0.15, ease: "easeInOut" }
          }
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--a)",
            boxShadow: "0 0 10px rgba(0,210,182,0.55)",
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}
