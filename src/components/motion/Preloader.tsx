"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";

export interface PreloaderProps {
  onDone?: () => void;
}

const FADE_MS = 200;
const TOTAL_MS = 1200;

/**
 * Full-screen brand preloader: logo pulses while a thin bar fills over ~1s,
 * then the overlay fades out and unmounts (total <= 1.2s). Clicking anywhere
 * skips. Logo only — no text, so nothing to translate. Renders null when the
 * user prefers reduced motion.
 */
export default function Preloader({ onDone }: PreloaderProps) {
  // Start enabled so SSR and hydration agree (both render the overlay);
  // the effect downgrades to null for reduced-motion users.
  const [enabled, setEnabled] = useState<boolean>(true);
  const [fading, setFading] = useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(true);
  const timers = useRef<number[]>([]);

  const finish = useCallback(() => {
    setFading(true);
    timers.current.push(
      window.setTimeout(() => {
        setVisible(false);
        onDone?.();
      }, FADE_MS),
    );
  }, [onDone]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEnabled(false);
      setVisible(false);
      return;
    }
    timers.current.push(window.setTimeout(finish, TOTAL_MS - FADE_MS));
    const all = timers.current;
    return () => {
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
        background: "var(--bg, #05070f)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        cursor: "pointer",
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <div
        style={{
          animation: "preloader-pulse 1s ease-in-out infinite",
        }}
      >
        <Logo size={76} />
      </div>
      <div
        style={{
          width: 128,
          height: 2,
          borderRadius: 2,
          overflow: "hidden",
          background: "rgba(255, 255, 255, 0.14)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            background: "#5982ff",
            transformOrigin: "left center",
            animation: "preloader-bar 1s linear forwards",
          }}
        />
      </div>
      <style>{`@keyframes preloader-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}@keyframes preloader-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
    </div>
  );
}
