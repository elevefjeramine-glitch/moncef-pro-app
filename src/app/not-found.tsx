import Link from 'next/link';

// Page 404 brandée en français (remplace la 404 Next.js par défaut en anglais).
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 16,
        padding: 24,
        background: '#060a14',
      }}
    >
      <div style={{ fontSize: 64 }} aria-hidden="true">🧭</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 }}>
        Page introuvable
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.65)', maxWidth: 420, margin: 0 }}>
        Cette page n'existe pas ou a été déplacée. Pas de panique, on te ramène
        en terrain connu.
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <Link href="/" className="btn" style={{ textDecoration: 'none' }}>
          Accueil du site
        </Link>
        <Link
          href="/app"
          className="btn-ghost btn"
          style={{ textDecoration: 'none' }}
        >
          Mon espace
        </Link>
      </div>
    </div>
  );
}
