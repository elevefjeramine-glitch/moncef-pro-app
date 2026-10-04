import type { MetadataRoute } from "next";

// Sitemap des pages publiques uniquement : l'espace connecté (/app) et les
// routes /api/* sont exclus (protégés par authentification, cf. robots.txt).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://proappmoncef.netlify.app";
  const pages: Array<{ path: string; priority: number; changeFrequency: "weekly" | "monthly" }> = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/auth", priority: 0.8, changeFrequency: "monthly" },
    { path: "/api-docs", priority: 0.6, changeFrequency: "monthly" },
    { path: "/status", priority: 0.5, changeFrequency: "weekly" },
    { path: "/privacy", priority: 0.4, changeFrequency: "monthly" },
    { path: "/terms", priority: 0.4, changeFrequency: "monthly" },
  ];
  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
