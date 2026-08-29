"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/utils/supabase/client";
import { t } from "@/utils/i18n";

/**
 * Deuxième moitié du « mot de passe oublié ».
 *
 * Le lien envoyé par Supabase atterrit sur /auth/callback?type=recovery : l'échange
 * du code donne une session de récupération, et cette page la reçoit. Elle ne fait
 * UNE chose que si la session porte bien la marque de la récupération
 * (`recovery_sent_at`) : écrire le nouveau mot de passe avec `updateUser`.
 *
 * Pourquoi ce n'était pas optionnel : sans cette page, le lien de réinitialisation
 * connectait l'utilisateur… avec son ancien mot de passe toujours en place. Le
 * renvoi sur /app donnait l'illusion d'un compte rentré, et la connexion suivante
 * échouait de nouveau. Un compte sans mot de passe connu (créé par Google, par
 * exemple) n'avait donc AUCUN moyen d'en poser un.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  // Lecture paresseuse, comme /auth/callback : `useState(() => …)` évite l'appel à
  // setLang dans l'effet (react-hooks/set-state-in-effect, sévérité 2) sans attendre
  // un second rendu pour afficher la bonne langue.
  const [lang] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("site_lang") || "fr" : "fr"
  );
  const [pret, setPret] = useState(false);
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user as { recovery_sent_at?: string | null; email?: string } | undefined;
      if (session && u?.recovery_sent_at) {
        setEmail(u.email ?? "");
        setPret(true);
      } else {
        setPret(false);
      }
    });
  }, []);

  const valider = async () => {
    setErreur("");
    if (pwd.length < 8) { setErreur(t(lang, "auth_reset_weak")); return; }
    if (pwd !== pwd2) { setErreur(t(lang, "auth_reset_mismatch")); return; }
    setEnCours(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setEnCours(false);
    if (error) {
      setErreur(`${t(lang, "auth_reset_failed")} — ${error.message}`);
      return;
    }
    setFait(true);
    // La session en cours EST déjà à jour : on y reste, aucun re-log à faire.
    setTimeout(() => router.replace("/app"), 1400);
  };

  const champ: React.CSSProperties = {
    width: "100%", height: 46, paddingLeft: 38, paddingRight: 44, borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)",
    color: "inherit", fontSize: 15, outline: "none",
  };
  const boite: React.CSSProperties = { position: "relative", marginBottom: 14 };
  const etiquette: React.CSSProperties = { display: "block", fontSize: 11.5, opacity: 0.55, marginBottom: 6, fontWeight: 700, letterSpacing: "0.04em" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)" }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: "100%", maxWidth: 440, padding: "40px 36px", borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <ShieldCheck size={18} style={{ color: "var(--a)" }} />
          <h1 style={{ fontSize: 22, margin: 0, letterSpacing: "-0.02em" }}>{t(lang, "auth_reset_title")}</h1>
        </div>

        {!pret && !fait && (
          <>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, margin: "10px 0 20px" }}>
              {t(lang, "auth_reset_nosession")}
            </p>
            <button type="button" className="btn" style={{ width: "100%", height: 46 }} onClick={() => router.replace("/auth?tab=login")}>
              {t(lang, "auth_switch_login")}
            </button>
          </>
        )}

        {pret && !fait && (
          <>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "6px 0 20px", lineHeight: 1.55 }}>
              {t(lang, "auth_reset_lede")} {email ? `· ${email}` : ""}
            </p>
            <div style={boite}>
              <label style={etiquette}>{t(lang, "auth_new_pwd")}</label>
              <Lock size={14} style={{ position: "absolute", left: 13, bottom: 15, color: "rgba(255,255,255,0.3)" }} />
              <input type={voir ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)} style={champ}
                autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="••••••••" />
              <button type="button" onClick={() => setVoir(!voir)} aria-label={voir ? "cacher" : "montrer"}
                style={{ position: "absolute", right: 12, bottom: 14, background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 2 }}>
                {voir ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={boite}>
              <label style={etiquette}>{t(lang, "auth_new_pwd_confirm")}</label>
              <Lock size={14} style={{ position: "absolute", left: 13, bottom: 15, color: "rgba(255,255,255,0.3)" }} />
              <input type={voir ? "text" : "password"} value={pwd2} onChange={(e) => setPwd2(e.target.value)} style={champ}
                autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="••••••••" />
            </div>
            {erreur && <p role="alert" style={{ color: "#ff6b6b", fontSize: 13, margin: "2px 0 12px", lineHeight: 1.5 }}>{erreur}</p>}
            <button type="button" className="btn" style={{ width: "100%", height: 48, marginTop: 6 }} onClick={valider} disabled={enCours}>
              {enCours ? "…" : t(lang, "auth_reset_save")}
            </button>
            <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", margin: "14px 0 0", lineHeight: 1.5 }}>
              {t(lang, "auth_reset_note")}
            </p>
          </>
        )}

        {fait && (
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", margin: "14px 0 0", lineHeight: 1.6 }}>
            ✓ {t(lang, "auth_reset_done")}
          </p>
        )}
      </motion.div>
    </div>
  );
}
