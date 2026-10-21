"use client";

import type { ReactNode } from "react";

export interface StickerProps {
  children: ReactNode;
  className?: string;
  /** tilt in degrees, applied as resting rotation */
  tilt?: number;
  /** float amplitude variant */
  drift?: "a" | "b";
}

/**
 * Sticker-like floating badge: slight resting rotation + gentle float loop.
 * Feels physical, not decorative-filler. Hidden from AT (content is duplicated
 * nearby in plain text) — pass aria-hidden content only.
 */
export default function Sticker({ children, className, tilt = -4, drift = "a" }: StickerProps) {
  return (
    <span
      aria-hidden="true"
      className={`sticker sticker-drift-${drift}${className ? ` ${className}` : ""}`}
      style={{ ["--sticker-tilt" as string]: `${tilt}deg` }}
    >
      {children}
    </span>
  );
}
