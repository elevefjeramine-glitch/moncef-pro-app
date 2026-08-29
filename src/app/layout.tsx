import "./globals.css";
import Cursor from "@/components/Cursor";
import Loader from "@/components/Loader";
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
  title: "Moncef IA — Plateforme Éducative Intelligente",
  description: "Plateforme éducative propulsée par l'Intelligence Artificielle. Gérez vos devoirs, emploi du temps et progressez avec l'IA.",
  keywords: "intelligence artificielle, éducation, devoirs, emploi du temps, lycée",
  // PWA (lot A3) : le manifeste vit dans `public/`, donc versionné et servi par le même
  // hôte que le site — pas de CDN tiers, aucun indicateur de présence envoyé ailleurs.
  // `manifest` est laissé à Next : il existe un `src/app/manifest.ts`, qui sert l'URL avec
  // le bon type. `theme_color` en revanche ne vit PAS dans `metadata` (mesuré : le meta
  // n'arrivait pas au HTML) — il est dans `viewport`, exporté juste en dessous.
  icons: { icon: "/icon-192.png", apple: "/icon-apple-180.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Moncef IA" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Moncef IA",
    description: "La plateforme éducative IA nouvelle génération.",
    type: "website"
  }
};

export const viewport = {
  themeColor: "#0b1f13",
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
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
