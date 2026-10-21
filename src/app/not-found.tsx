'use client';

import { useState } from 'react';
import Link from 'next/link';
import { t } from '@/utils/i18n';

// Page 404 : hors du LanguageContext.Provider (monté seulement dans /app),
// on lit la langue persistée comme les autres pages publiques (site_lang).
export default function NotFound() {
  const [lang] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('site_lang') || 'fr' : 'fr'));
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
        {t(lang, 'notfound_titre')}
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.65)', maxWidth: 420, margin: 0 }}>
        {t(lang, 'notfound_message')}
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <Link href="/" className="btn" style={{ textDecoration: 'none' }}>
          {t(lang, 'notfound_accueil_site')}
        </Link>
        <Link
          href="/app"
          className="btn-ghost btn"
          style={{ textDecoration: 'none' }}
        >
          {t(lang, 'notfound_mon_espace')}
        </Link>
      </div>
    </div>
  );
}
