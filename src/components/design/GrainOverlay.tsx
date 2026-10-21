"use client";

/**
 * Subtle film-grain overlay for the whole landing: an inline SVG feTurbulence
 * texture at very low opacity. Pure CSS/SVG — zero runtime cost. Decorative.
 */
export default function GrainOverlay() {
  return <div className="grain-overlay" aria-hidden="true" />;
}
