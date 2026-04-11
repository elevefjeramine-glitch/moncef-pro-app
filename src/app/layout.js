import "./globals.css";

export const metadata = {
  title: "Moncef IA — Plateforme Éducative Intelligente",
  description: "Plateforme éducative propulsée par l'Intelligence Artificielle.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Raleway:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="mesh" />
        <canvas id="pc" style={{position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none'}} />
        {children}
      </body>
    </html>
  );
}
