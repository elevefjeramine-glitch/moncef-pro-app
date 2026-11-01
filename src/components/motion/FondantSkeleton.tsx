"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * FondantSkeleton — état de chargement « fondant » pour une analyse de photo
 * ou une génération de fiches : des lignes-bulles qui pulsent en vague
 * (classe `fondant-skeleton` de globals.css) au lieu d'un simple spinner.
 * Réutilise le shimmer de Skeleton, sans nouveau composant lourd.
 */
export default function FondantSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ["92%", "78%", "60%", "84%", "66%"];
  return (
    <div
      role="status"
      aria-label="Chargement en cours"
      style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="fondant-skeleton"
          style={{
            height: 14,
            width: widths[i % widths.length],
            borderRadius: 999,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
