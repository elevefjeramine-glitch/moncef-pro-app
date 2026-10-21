'use client';

import { useEffect } from 'react';
import { useLanguage, t } from '@/utils/i18n';

// Error boundary pour l'espace connecté (/app) — remplace l'écran blanc
// en cas de crash d'une page avec un message humain et un bouton de retry.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erreur dans /app :', error);
  }, [error]);
  const lang = useLanguage();

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 16,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 56 }} aria-hidden="true">😵</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>
        {t(lang, 'err_titre')}
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.65)', maxWidth: 420, margin: 0 }}>
        {t(lang, 'err_message')}
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button className="btn" onClick={reset}>
          {t(lang, 'err_reessayer')}
        </button>
        <button
          className="btn-ghost btn"
          onClick={() => (window.location.href = '/app')}
        >
          {t(lang, 'err_retour_accueil')}
        </button>
      </div>
    </div>
  );
}
