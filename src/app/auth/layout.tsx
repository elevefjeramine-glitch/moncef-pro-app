import type { Metadata } from "next";

/**
 * Métadonnées SEO dédiées à la page d'authentification (/auth).
 * La page est un client component : les métadonnées vivent ici, dans ce
 * layout serveur parent. FR assumé (public cible francophone).
 */
export const metadata: Metadata = {
  title: "Connexion / Inscription — Moncef IA",
  description:
    "Crée ton compte Moncef IA gratuitement : un e-mail, un mot de passe, ton prénom — et 700 crédits IA offerts chaque jour pour tes devoirs et révisions.",
  alternates: { canonical: "https://proappmoncef.netlify.app/auth" },
  openGraph: {
    title: "Rejoins Moncef IA — gratuit",
    description:
      "Crée ton compte Moncef IA : 700 crédits IA offerts chaque jour, sans carte bancaire.",
    url: "https://proappmoncef.netlify.app/auth",
    siteName: "Moncef IA",
    locale: "fr_FR",
    type: "website",
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
