"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionStyle,
} from "framer-motion";

type Props = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Inclinaison max en degrés (défaut 8). */
  maxTilt?: number;
  /** Couleur de la lueur radiale qui suit le curseur. */
  glowColor?: string;
  /** Désactive la lueur (le tilt reste actif). */
  glow?: boolean;
};

/**
 * Carte 3D de la page profil : tilt en perspective + lueur radiale
 * qui suivent la souris.
 * - 100 % transform/opacity, zéro re-render pendant le survol
 *   (motion values framer-motion + CSS variables posées sur le nœud DOM).
 * - Retour au repos fluide via springs.
 * - Désactivé proprement si prefers-reduced-motion (rendu statique).
 * - Au tactile : onMouseMove ne se déclenche pas, aucun effet de bord.
 *
 * (Composant distinct du TiltCard react-spring utilisé ailleurs sur le site.)
 */
export default function ProfilTilt({
  children,
  className = "",
  style,
  maxTilt = 8,
  glowColor = "rgba(89,130,255,0.14)",
  glow = true,
}: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Motion values : toujours déclarées (ordre des hooks stable),
  // simplement inutilisées quand reduceMotion est actif.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spx = useSpring(px, { stiffness: 220, damping: 20, mass: 0.6 });
  const spy = useSpring(py, { stiffness: 220, damping: 20, mass: 0.6 });
  const rotateX = useTransform(spy, [0, 1], [maxTilt, -maxTilt]);
  const rotateY = useTransform(spx, [0, 1], [-maxTilt, maxTilt]);

  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const ny = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    px.set(nx);
    py.set(ny);
    if (glow) {
      el.style.setProperty("--mx", `${(nx * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(ny * 100).toFixed(1)}%`);
    }
  };

  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`profil-tilt ${className}`}
      style={
        {
          rotateX,
          rotateY,
          transformPerspective: 900,
          "--tilt-glow": glowColor,
          ...style,
        } as MotionStyle
      }
    >
      {children}
    </motion.div>
  );
}
