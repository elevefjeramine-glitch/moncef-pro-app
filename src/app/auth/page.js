"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

import { t } from "@/utils/i18n";

export default function AuthPage() {
  const [tab, setTab] = useState("login");
  const [lang, setLang] = useState("fr");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem('site_lang');
    if (saved) setLang(saved);
  }, []);

  useEffect(() => { 
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; 
    localStorage.setItem('site_lang', lang);
  }, [lang]);

  const handleAuth = async () => { /* Même logique qu'avant */
    setLoading(true); setErrorMsg(""); setSuccessMsg("");
    if (!email || !password) { setErrorMsg("Veuillez remplir tous les champs."); setLoading(false); return; }
    if (tab === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setErrorMsg(error.message); else setSuccessMsg("Compte créé ! Vérifiez vos emails.");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMsg(error.message); else window.location.href = "/app";
    }
    setLoading(false);
  };

  const handleOAuth = async (provider) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: provider, options: { redirectTo: `${window.location.origin}/app`, queryParams: { prompt: 'select_account' } } });
    if (error) { setErrorMsg(`Configuration requise: ${error.message}`); setLoading(false); }
  };

  const IconGoogle = () => <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;
  const IconMicrosoft = () => <svg width="20" height="20" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>;
  const IconApple = () => <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-1.996.04-3.875 1.155-4.896 2.936-2.062 3.593-.526 8.895 1.488 11.83 1.002 1.442 2.164 3.063 3.711 3.003 1.492-.06 2.062-.973 3.864-.973 1.782 0 2.305.973 3.864.954 1.622-.04 2.628-1.488 3.61-2.916 1.137-1.666 1.603-3.275 1.624-3.355-.04-.018-3.136-1.2-3.155-4.79-.02-2.99 2.454-4.437 2.574-4.516-1.396-2.023-3.565-2.28-4.328-2.32-1.897-.138-3.795 1.187-4.4 1.187zm-1.127-4.103c.803-.97 1.345-2.316 1.198-3.666-1.144.047-2.553.766-3.376 1.724-.658.747-1.275 2.122-1.106 3.447 1.284.1 2.502-.553 3.284-1.505z"/></svg>;
  const IconGitHub = () => <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/></svg>;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="auth-box" style={{ width: '100%', maxWidth: '440px', padding: '48px 40px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ fontSize: '32px', color: 'var(--a)', marginBottom: '8px', textShadow: '0 0 20px rgba(0,210,182,0.4)' }}>🎓 Moncef IA</motion.h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>{t(lang, 'hero_badge')}</p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px", marginBottom: "32px" }}>
          {['fr', 'en', 'es', 'ar', 'zh'].map(l => (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} key={l} className="btn-sec" style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '8px', background: lang === l ? 'var(--p)' : 'rgba(255,255,255,0.05)', color: lang === l ? '#fff' : 'rgba(255,255,255,0.6)', border: lang === l ? '1px solid var(--p)' : '1px solid rgba(255,255,255,0.1)' }} onClick={() => setLang(l)}>
              {l === 'fr' ? '🇫🇷 FR' : l === 'en' ? '🇬🇧 EN' : l === 'es' ? '🇪🇸 ES' : l === 'ar' ? '🇸🇦 AR' : '🇨🇳 ZH'}
            </motion.button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.3)", padding: "6px", borderRadius: "14px", marginBottom: "28px" }}>
          {['login', 'signup'].map(tb => (
            <button key={tb} onClick={() => setTab(tb)} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: tab === tb ? 'var(--p)' : 'transparent', border: 'none', color: tab === tb ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s' }}>
              {tb === 'login' ? t(lang, 'auth_title_login') : t(lang, 'auth_title_signup')}
            </button>
          ))}
        </div>
        
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
            {errorMsg && <div style={{ color: "var(--err)", fontSize: "14px", marginBottom: "20px", textAlign: "center", padding: "12px", background: "rgba(255,69,69,0.1)", borderRadius: "10px", border: "1px solid rgba(255,69,69,0.2)" }}>{errorMsg}</div>}
            {successMsg && <div style={{ color: "var(--ok)", fontSize: "14px", marginBottom: "20px", textAlign: "center", padding: "12px", background: "rgba(0,230,138,0.1)", borderRadius: "10px", border: "1px solid rgba(0,230,138,0.2)" }}>{successMsg}</div>}
            
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>{t(lang, 'auth_email')}</label>
              <input type="email" className="fi" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" />
            </div>
            <div style={{ marginBottom: "28px", position: "relative" }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>{t(lang, 'auth_pwd')}</label>
              <input type={showPw ? "text" : "password"} className="fi" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight: "40px" }} />
              <button type="button" style={{ position: "absolute", right: "12px", bottom: "12px", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "18px" }} onClick={() => setShowPw(!showPw)}>
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn" style={{ width: "100%", height: "52px", fontSize: "16px" }} onClick={handleAuth} disabled={loading}>
              {loading ? "..." : (tab === "login" ? t(lang, 'auth_btn_login') : t(lang, 'auth_btn_signup'))}
            </motion.button>
            
            <div className="oauth-grid">
              <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} className="oauth-btn" onClick={() => handleOAuth('google')}><IconGoogle /> Google</motion.button>
              <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} className="oauth-btn" onClick={() => handleOAuth('azure')}><IconMicrosoft /> Microsoft</motion.button>
              <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} className="oauth-btn" onClick={() => handleOAuth('apple')}><IconApple /> Apple</motion.button>
              <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} className="oauth-btn" onClick={() => handleOAuth('github')}><IconGitHub /> GitHub</motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
