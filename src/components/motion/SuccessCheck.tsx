"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * SuccessCheck — coche dessinée trait par trait (pathLength animé),
 * utilisée comme confirmation visuelle d'un ajout réussi (ex. un devoir).
 * prefers-reduced-motion : coche pleine immédiate, sans tracé.
 */
export default function SuccessCheck({ size = 20 }: { size?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      initial={false}
      style={{ flexShrink: 0, color: "var(--a)" }}
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.4, ease: "easeOut" }}
      />
      <motion.path
        d="M8 12.5 L11 15.5 L16 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : 0.3, ease: "easeOut" }}
      />
    </motion.svg>
  );
}
