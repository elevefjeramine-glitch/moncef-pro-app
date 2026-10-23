"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";

export interface PreloaderProps {
  onDone?: () => void;
}

const MIN_MS = 500; // never flash: keep the brand beat at least this long
const MAX_MS = 800; // hard cap — the 1.2s artificial wait was rejected
const FADE_MS = 250; // dissolve-out ("fondant")

/**
 * Brand preloader v2 (Amine's feedback, 2026-10-23): the style and the wait
 * were the problem — no black void, no cheap infinite pulse, no 1.2s block.
 *
 * - Deep-navy radial ambience with a soft brand glow behind the logo, so the
 *   overlay feels like the site's own atmosphere rather than a black screen.
 * - The official logo (unchanged) "melts" in: blurred and slightly small,
 *   then resolving sharp with a springy ease. The halo breathes once, no loop.
 * - One thin glowing gradient line sweeps under the logo (~600ms).
 * - Exit dissolves: the logo swells a touch and blurs as the overlay fades,
 *   melting into the page instead of cutting away.
 * - Finishes when the window has loaded (min 500ms, hard cap 800ms).
 *   Clicking anywhere skips. Renders null for prefers-reduced-motion.
 *   Logo only — no text, so nothing to translate.
 */
export default function Preloader({ onDone }: PreloaderProps) {
  // Start enabled so SSR and hydration agree (both render the overlay);
  // the effect downgrades to null for reduced-motion users.
  const [enabled, setEnabled] = useState<boolean>(true);
  const [fading, setFading] = useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(true);
  const timers = useRef<number[]>([]);

  const finish = useCallback(() => {
    setFading((prev) => {
      if (prev) return prev;
      timers.current.push(
        window.setTimeout(() => {
          setVisible(false);
          onDone?.();
        }, FADE_MS),
      );
      return true;
    });
  }, [onDone]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEnabled(false);
      setVisible(false);
      return;
    }
    const start = performance.now();
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      const wait = Math.max(0, MIN_MS - (performance.now() - start));
      timers.current.push(window.setTimeout(finish, wait));
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    timers.current.push(window.setTimeout(schedule, MAX_MS));
    const all = timers.current;
    return () => {
      window.removeEventListener("load", schedule);
      all.forEach((t) => window.clearTimeout(t));
      all.length = 0;
    };
  }, [finish]);

  if (!enabled || !visible) return null;

  return (
    <div
      onClick={finish}
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background:
          "radial-gradient(120% 90% at 50% 38%, #101a33 0%, var(--bg, #060a14) 62%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 30,
        cursor: "pointer",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: fading
            ? `preloader-melt-out ${FADE_MS}ms ease forwards`
            : undefined,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            width: 190,
            height: 190,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.38) 0%, rgba(99,102,241,0) 68%)",
            animation: "preloader-halo 0.8s ease-out forwards",
          }}
        />
        <div
          style={{
            animation:
              "preloader-melt-in 0.55s cubic-bezier(0.22, 1.4, 0.36, 1) forwards",
          }}
        >
          <Logo size={76} />
        </div>
      </div>
      <div
        style={{
          width: 148,
          height: 3,
          borderRadius: 999,
          overflow: "hidden",
          background: "rgba(148,163,255,0.16)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #6366f1 0%, #22d3ee 100%)",
            boxShadow: "0 0 12px rgba(56,189,248,0.55)",
            transformOrigin: "left center",
            animation:
              "preloader-sweep 0.6s cubic-bezier(0.3, 0.7, 0.3, 1) forwards",
          }}
        />
      </div>
      <style>{`
        @keyframes preloader-melt-in {
          0% { transform: scale(0.88); filter: blur(14px); opacity: 0; }
          60% { filter: blur(3px); opacity: 1; }
          100% { transform: scale(1); filter: blur(0); opacity: 1; }
        }
        @keyframes preloader-melt-out {
          from { transform: scale(1); filter: blur(0); opacity: 1; }
          to { transform: scale(1.07); filter: blur(10px); opacity: 0.9; }
        }
        @keyframes preloader-halo {
          0% { transform: scale(0.55); opacity: 0; }
          45% { opacity: 1; }
          100% { transform: scale(1.12); opacity: 0.55; }
        }
        @keyframes preloader-sweep {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
