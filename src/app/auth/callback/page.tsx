"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import { t } from "@/utils/i18n";

/**
 * Destination unique des retours OAuth (Google / Microsoft / Apple / GitHub).
 *
 * Pourquoi une page dédiée au lieu de renvoyer directement sur /app : avec PKCE,
 * supabase-js doit échanger le `code` de l'URL contre une session, et cet échange est
 * asynchrone. Si l'on atterrit sur /app, le contrôle d'accès de ce layout lit la session
 * avant la fin de l'échange, la trouve vide, et éjecte l'utilisateur sur /auth :
 * connexion perdue juste après un Google réussi. Ici on attend l'événement.
 */
function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [lang] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('site_lang') || 'fr' : 'fr'));
  // useSearchParams rend un objet vide au prerender : pas besoin de garde window ici,
  // mais on reste défensif car la page peut être rendue côté serveur.
  const urlErr = (typeof window === 'undefined' || !params) ? "" : (params.get("error_description") || params.get("error_code") || "");
  // L'échec vient de l'URL : on le dérive à chaque rendu, aucun setState là-dessus.
  const [exchangeFailed, setExchangeFailed] = useState(false);

  useEffect(() => {
    // 1) échec déjà signalé par Supabase dans l'URL : rien à échanger, on affiche.
    if (urlErr) return;

    let settled = false;
    const finish = async () => {
      if (settled) return;
      settled = true;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace("/app");
      else setExchangeFailed(true);
    };

    // 2) échec côté client (bout « Autoriser » puis retour) : on est déjà ici,
    //    l'échange tourne ; on écoute sa fin plutôt que de le deviner par timeout.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        settled = true;
        router.replace("/app");
      }
    });

    // 3) filet de sécurité si aucun événement n'arrive (fournisseur muet, onglet
    //    repris en arrière-plan, etc.).
    const guard = setTimeout(finish, 6000);

    return () => { clearTimeout(guard); data.subscription.unsubscribe(); };
  }, [urlErr, router, lang]);

  const msg = urlErr ? decodeURIComponent(urlErr) : (exchangeFailed ? t(lang, "auth_oauth_failed") : null);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", gap: 18, padding: 24, textAlign: "center" }}>
      {msg ? (
        <>
          <div style={{ fontSize: 34 }}>⚠️</div>
          <div style={{ color: "#ff6b6b", fontSize: 15, maxWidth: 420, lineHeight: 1.5 }}>{msg}</div>
          <button onClick={() => router.replace("/auth")} className="btn-primary" style={{ marginTop: 8 }}>
            {t(lang, "auth_switch_login")}
          </button>
        </>
      ) : (
        <>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--a)", borderRadius: "50%" }} />
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{t(lang, "auth_oauth_waiting")}</div>
        </>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
