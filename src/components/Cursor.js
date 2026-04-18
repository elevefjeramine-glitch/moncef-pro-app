"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

export default function Cursor() {
  const [pos, setPos]         = useState({ x: 0, y: 0 });
  const [ring, setRing]       = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const rafRef = useRef(null);
  const targetRing = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    setIsMobile(false);

    // Smooth ring follow with lerp
    const lerp = (a, b, t) => a + (b - a) * t;
    const animateRing = () => {
      setRing(prev => ({
        x: lerp(prev.x, targetRing.current.x, 0.12),
        y: lerp(prev.y, targetRing.current.y, 0.12)
      }));
      rafRef.current = requestAnimationFrame(animateRing);
    };
    rafRef.current = requestAnimationFrame(animateRing);

    const onMove = (e) => {
      setPos({ x: e.clientX, y: e.clientY });
      targetRing.current = { x: e.clientX, y: e.clientY };
    };

    const onOver = (e) => {
      const el = e.target;
      const isInteractive =
        el.tagName === "A" || el.tagName === "BUTTON" ||
        el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" ||
        el.closest("a") || el.closest("button") ||
        el.classList.contains("interactive") || el.getAttribute("role") === "button";
      setHovering(!!isInteractive);
    };

    const onDown = () => setClicking(true);
    const onUp   = () => setClicking(false);

    document.body.style.cursor = "none";
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("mouseup",   onUp,   { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.body.style.cursor = "auto";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  if (isMobile) return null;

  return (
    <div style={{ pointerEvents: "none", zIndex: 99999, position: "fixed", inset: 0 }}>
      {/* Dot */}
      <motion.div
        style={{
          position: "fixed",
          x: pos.x - 4, y: pos.y - 4,
          width: 8, height: 8, borderRadius: "50%",
          background: hovering ? "rgba(255,255,255,0.9)" : "hsl(174,100%,55%)",
          boxShadow: hovering ? "0 0 12px rgba(255,255,255,0.5)" : "0 0 14px hsl(174,100%,55%)",
          scale: clicking ? 0.5 : hovering ? 0 : 1,
        }}
        transition={{ type: "tween", duration: 0.05 }}
      />

      {/* Ring — lerp animated */}
      <div
        style={{
          position: "fixed",
          left: ring.x - 20, top: ring.y - 20,
          width: hovering ? 44 : clicking ? 28 : 38,
          height: hovering ? 44 : clicking ? 28 : 38,
          borderRadius: "50%",
          border: hovering
            ? "1.5px solid hsl(174,100%,55%)"
            : "1.5px solid rgba(255,255,255,0.22)",
          background: hovering ? "rgba(0,208,178,0.08)" : "transparent",
          boxShadow: hovering ? "0 0 20px rgba(0,208,178,0.15), inset 0 0 10px rgba(0,208,178,0.05)" : "none",
          transform: `translate(${hovering ? (44-38)/2 : clicking ? (28-38)/2 : 0}px, ${hovering ? (44-38)/2 : clicking ? (28-38)/2 : 0}px)`,
          transition: "width 0.22s cubic-bezier(0.16,1,0.3,1), height 0.22s cubic-bezier(0.16,1,0.3,1), border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.22s ease",
          pointerEvents: "none"
        }}
      />
    </div>
  );
}
