import "./globals.css";
import Cursor from "@/components/Cursor";
import Loader from "@/components/Loader";
import SeoJsonLd from "@/components/SeoJsonLd";
import QueryProvider from "@/providers/QueryProvider";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/ThemeProvider";

import { Plus_Jakarta_Sans, Sora, JetBrains_Mono } from "next/font/google";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});
const fontHeading = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
});
const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata = {
  metadataBase: new URL("https://proappmoncef.netlify.app"),
  // SEO (2026-10-04) : la marque en premier, puis l'accroche réelle —
  // gratuit + devoirs/révisions (public cible : élèves francophones).
  title: "Moncef IA — L'IA gratuite pour tes devoirs et révisions",
  description: "Moncef IA, la plateforme éducative propulsée par l'intelligence artificielle : organise tes devoirs, révise avec Thunder IA et suis ton emploi du temps. 700 crédits IA offerts chaque jour, sans carte bancaire.",
  // PWA (lot A3) : le manifeste vit dans `public/`, donc versionné et servi par le même
  // hôte que le site — pas de CDN tiers, aucun indicateur de présence envoyé ailleurs.
  // `manifest` est laissé à Next : il existe un `src/app/manifest.ts`, qui sert l'URL avec
  // le bon type. `theme_color` en revanche ne vit PAS dans `metadata` (mesuré : le meta
  // n'arrivait pas au HTML) — il est dans `viewport`, exporté juste en dessous.
  icons: { icon: "/icon-192.png", apple: "/icon-apple-180.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Moncef IA" },
  formatDetection: { telephone: false },
  // Search Console (2026-10-04) : validation de la propriété
  // https://proappmoncef.netlify.app/ — cliquer "Valider" dans la Search
  // Console une fois déployé (21/10).
  verification: { google: "_QhgrMgDvmRY-PRJnPKlQTxeCv0fPuGJ9aC7bwXZShg" },
  alternates: { canonical: "https://proappmoncef.netlify.app/" },
  openGraph: {
    title: "Moncef IA — L'IA gratuite pour tes devoirs et révisions",
    description: "Organise tes devoirs, révise avec Thunder IA et suis ton emploi du temps. 700 crédits IA offerts chaque jour, sans carte bancaire.",
    type: "website",
    url: "https://proappmoncef.netlify.app/",
    siteName: "Moncef IA",
    locale: "fr_FR",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Moncef IA — la plateforme éducative IA pour tes devoirs et révisions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Moncef IA — L'IA gratuite pour tes devoirs et révisions",
    description: "Organise tes devoirs, révise avec Thunder IA et suis ton emploi du temps. 700 crédits IA offerts chaque jour, sans carte bancaire.",
    images: ["/og-image.png"],
  },
};

export const viewport = {
  // C10/SEO (audit 2026-10-04) : theme-color aligné sur le fond réel --bg (#060a14),
  // l'ancienne valeur #0b1f13 (vert) ne correspondait à aucune couleur du site.
  themeColor: "#060a14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "dark" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable}`}>
      <head>
        {/* Données structurées schema.org : Organization + WebApplication + FAQPage */}
        <SeoJsonLd />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <QueryProvider>
            <Cursor />
            <Loader />
            <div className="mesh" aria-hidden="true" />
            <canvas id="pc" style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }} aria-hidden="true" />
            {children}
            <Toaster 
              theme="dark" 
              toastOptions={{
                style: {
                  background: 'rgba(10, 15, 30, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  color: '#fff',
                }
              }}
            />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
