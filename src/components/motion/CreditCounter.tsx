"use client";

import { useEffect, useRef, useState } from "react";

/**
 * CreditCounter — compteur de crédits animé d'une valeur RÉELLE à l'autre
 * (jamais de 0, jamais de chiffre inventé) : quand le solde change
 * (débit d'une réponse, recharge), le nombre glisse vers la nouvelle valeur.
 * prefers-reduced-motion : affichage immédiat, sans animation.
 * Contrairement à AnimatedCounter (compte 0 -> valeur à l'apparition),
 * celui-ci conserve la valeur précédente entre deux rendus.
 */
export default function CreditCounter({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) {
      setDisplay(value);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const t0 = performance.now();
    const duration = 600;
    let raf = 0;
    const tick = (now: number): void => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {display}
      {suffix}
    </span>
  );
}
