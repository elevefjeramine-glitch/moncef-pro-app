import type { MetadataRoute } from "next";

/**
 * Le manifeste de l'application, servi par Next plutôt que posé dans `public/`.
 *
 * La raison est une mesure, pas un goût : `public/manifest.webmanifest` sortait en
 * `application/octet-stream` (Netlify ne connaît pas l'extension, et son type de fichier
 * statique ne se laisse pas écraser par un en-tête). Avec `X-Content-Type-Options:
 * nosniff` posé sur tout le site, un manifeste en octet-stream est REJETÉ : le navigateur
 * ne propose jamais l'installation, et le bandeau « Installer » reste désactivé pour
 * l'élève. Ce fichier, lui, sort en `application/manifest+json`.
 *
 * `start_url` vise `/app` : c'est là qu'on est connecté, et `/` (la vitrine) n'a rien à
 * lire hors-ligne.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moncef IA — cahier de révision",
    short_name: "Moncef IA",
    id: "/app",
    description: "Fiches, QCM, révisions espacées, emploi du temps. Les fiches restent lisibles quand le réseau manque.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#0b1f13",
    theme_color: "#0b1f13",
    lang: "fr",
    dir: "ltr",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Thunder — poser une question", url: "/app/thunder", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
