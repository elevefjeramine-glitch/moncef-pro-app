import "./globals.css";
import Cursor from "@/components/Cursor";
import Loader from "@/components/Loader";
import QueryProvider from "@/providers/QueryProvider";
import { Toaster } from "sonner";

export const metadata = {
  title: "Moncef IA — Plateforme Éducative Intelligente",
  description: "Plateforme éducative propulsée par l'Intelligence Artificielle. Gérez vos devoirs, emploi du temps et progressez avec l'IA.",
  keywords: "intelligence artificielle, éducation, devoirs, emploi du temps, lycée",
  openGraph: {
    title: "Moncef IA",
    description: "La plateforme éducative IA nouvelle génération.",
    type: "website"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Sora:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
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
      </body>
    </html>
  );
}
