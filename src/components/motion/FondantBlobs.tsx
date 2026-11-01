"use client";

/**
 * FondantBlobs — orbes de dégradé qui fondent et fusionnent derrière un hero.
 * 100 % CSS (border-radius morph + translation lente) : aucun JS par frame,
 * aucun re-render. `aria-hidden` : purement décoratif.
 * prefers-reduced-motion est coupé par la règle globale de globals.css
 * (animation-duration quasi nulle) et par `.fondant-blob` ci-dessous.
 */
export default function FondantBlobs({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`fondant-blobs ${className}`}>
      <span className="fondant-blob fondant-blob--blue" />
      <span className="fondant-blob fondant-blob--teal" />
      <span className="fondant-blob fondant-blob--violet" />
    </div>
  );
}
