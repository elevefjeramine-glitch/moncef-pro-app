"use client";

import { useEffect, useRef, useState } from "react";

export interface AnimatedCounterProps {
  /** Final number to count up to. */
  value: number;
  /** Already-translated caption rendered under the number. */
  label: string;
  /** Duration of the count-up in seconds. */
  duration?: number;
  className?: string;
}

const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Counts 0 -> value with easeOutExpo the first time it scrolls into view.
 * Reduced motion renders the final value immediately.
 */
export default function AnimatedCounter({
  value,
  label,
  duration = 1.6,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [display, setDisplay] = useState<string>("0");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const finalText = Math.round(value).toString();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(finalText);
      return;
    }

    let raf = 0;
    let started = false;

    const run = (): void => {
      if (started) return;
      started = true;
      const t0 = performance.now();
      const tick = (now: number): void => {
        const progress = Math.min(1, (now - t0) / (duration * 1000));
        setDisplay(Math.round(value * easeOutExpo(progress)).toString());
        if (progress < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          setDisplay(finalText);
        }
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [value, duration]);

  return (
    <div ref={ref} className={className}>
      <div>{display}</div>
      <div>{label}</div>
    </div>
  );
}
