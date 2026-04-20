"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, Lock, Phone, MapPin, Building2, Hash, Eye, EyeOff, ChevronRight } from "lucide-react";
import { t } from "@/utils/i18n";

const LABEL_STYLE = {
  display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)',
  marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: '700'
};

const SECTION_STYLE = {
  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '1.5px', color: 'var(--a)', marginBottom: '14px',
  display: 'flex', alignItems: 'center', gap: 8
};

const DIVIDER = { height: '1px', background: 'rgba(255,255,255,0.06)', margin: '20px 0' };

function Field({ icon: Icon, label, badge, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <label style={LABEL_STYLE}>
          {Icon && <Icon size={11} style={{ display: 'inline', marginRight: 5 }} />}{label}
        </label>
        {badge && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

export default function AuthPage() {
  const [tab, setTab] = useState("login");
  const [lang, setLang] = useState("fr");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── Common fields ──────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ── Signup-only fields ─────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem('site_lang');
    if (saved) setLang(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('site_lang', lang);
  }, [lang]);

  // Reset form on tab switch
  const switchTab = (next) => {
    setTab(next);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleAuth = async () => {
    setLoading(true); setErrorMsg(""); setSuccessMsg("");

    if (tab === "signup") {
      if (!firstName || !lastName || !email || !password) {
        setErrorMsg(t(lang, 'auth_fill_required'));
        setLoading(false); return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName } }
      });
      if (error) {
        setErrorMsg(error.message);
      } else if (data.user) {
        // Save extended profile to users table
        await supabase.from('users').upsert({
          id: data.user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          address: address || null,
          city: city || null,
          postal_code: postal || null,
          role: 'normal'
        });
        setSuccessMsg(t(lang, 'auth_success'));
      }
    } else {
      if (!email || !password) {
        setErrorMsg(t(lang, 'auth_fill_required'));
        setLoading(false); return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMsg(error.message);
      else window.location.href = "/app";
    }
    setLoading(false);
  };

  const handleOAuth = async (provider) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/app`, queryParams: { prompt: 'select_account' } }
    });
    if (error) { setErrorMsg(`Configuration requise: ${error.message}`); setLoading(false); }
  };

  const IconGoogle = () => <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;
  const IconMicrosoft = () => <svg width="20" height="20" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>;
  const IconApple = () => <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-1.996.04-3.875 1.155-4.896 2.936-2.062 3.593-.526 8.895 1.488 11.83 1.002 1.442 2.164 3.063 3.711 3.003 1.492-.06 2.062-.973 3.864-.973 1.782 0 2.305.973 3.864.954 1.622-.04 2.628-1.488 3.61-2.916 1.137-1.666 1.603-3.275 1.624-3.355-.04-.018-3.136-1.2-3.155-4.79-.02-2.99 2.454-4.437 2.574-4.516-1.396-2.023-3.565-2.28-4.328-2.32-1.897-.138-3.795 1.187-4.4 1.187zm-1.127-4.103c.803-.97 1.345-2.316 1.198-3.666-1.144.047-2.553.766-3.376 1.724-.658.747-1.275 2.122-1.106 3.447 1.284.1 2.502-.553 3.284-1.505z"/></svg>;
  const IconGitHub = () => <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/></svg>;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="auth-box"
        style={{ width: '100%', maxWidth: tab === 'signup' ? '560px' : '440px', padding: '48px 40px', transition: 'max-width 0.4s ease' }}
      >
        {/* ── Logo ──────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ fontSize: '32px', color: 'var(--a)', marginBottom: '8px', textShadow: '0 0 20px rgba(0,210,182,0.4)' }}>
            🎓 Moncef IA
          </motion.h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>{t(lang, 'hero_badge')}</p>
        </div>

        {/* ── Language switcher ─────────────────────────────── */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px", marginBottom: "28px" }}>
          {['fr', 'en', 'es', 'ar', 'zh'].map(l => (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} key={l}
              onClick={() => setLang(l)}
              style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: lang === l ? 'var(--p)' : 'rgba(255,255,255,0.05)',
                color: lang === l ? '#fff' : 'rgba(255,255,255,0.6)' }}>
              {l === 'fr' ? '🇫🇷 FR' : l === 'en' ? '🇬🇧 EN' : l === 'es' ? '🇪🇸 ES' : l === 'ar' ? '🇸🇦 AR' : '🇨🇳 ZH'}
            </motion.button>
          ))}
        </div>

        {/* ── Tab toggle ─────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.3)", padding: "6px", borderRadius: "14px", marginBottom: "28px" }}>
          {['login', 'signup'].map(tb => (
            <button key={tb} onClick={() => switchTab(tb)}
              style={{ flex: 1, padding: "12px", borderRadius: "10px", border: 'none', cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s',
                background: tab === tb ? 'var(--p)' : 'transparent',
                color: tab === tb ? '#fff' : 'rgba(255,255,255,0.5)' }}>
              {tb === 'login' ? t(lang, 'auth_title_login') : t(lang, 'auth_title_signup')}
            </button>
          ))}
        </div>

        {/* ── Messages ──────────────────────────────────────── */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ color: "var(--err)", fontSize: "13px", marginBottom: "20px", padding: "12px 16px",
                background: "rgba(255,69,69,0.1)", borderRadius: "10px", border: "1px solid rgba(255,69,69,0.2)" }}>
              ⚠️ {errorMsg}
            </motion.div>
          )}
          {successMsg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ color: "var(--ok)", fontSize: "13px", marginBottom: "20px", padding: "12px 16px",
                background: "rgba(0,230,138,0.1)", borderRadius: "10px", border: "1px solid rgba(0,230,138,0.2)" }}>
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, x: tab === 'signup' ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}>

            {/* ════════════════ SIGNUP EXTRA FIELDS ════════════════ */}
            {tab === 'signup' && (
              <>
                {/* Section : Identité */}
                <div style={SECTION_STYLE}>
                  <User size={12} /> {t(lang, 'auth_first_name')} & {t(lang, 'auth_last_name')}
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{t(lang, 'auth_required_fields')}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <Field label={t(lang, 'auth_first_name')}>
                    <div style={{ position: 'relative' }}>
                      <User size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                      <input className="fi" value={firstName} onChange={e => setFirstName(e.target.value)}
                        placeholder={t(lang, 'auth_ph_firstname')}
                        style={{ height: 44, paddingLeft: 36 }} />
                    </div>
                  </Field>
                  <Field label={t(lang, 'auth_last_name')}>
                    <div style={{ position: 'relative' }}>
                      <User size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                      <input className="fi" value={lastName} onChange={e => setLastName(e.target.value)}
                        placeholder={t(lang, 'auth_ph_lastname')}
                        style={{ height: 44, paddingLeft: 36 }} />
                    </div>
                  </Field>
                </div>

                {/* Section : Contact */}
                <div style={{ ...SECTION_STYLE, marginTop: 4 }}>
                  <Phone size={12} /> {t(lang, 'auth_phone')}
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{t(lang, 'auth_optional')}</span>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ position: 'relative' }}>
                    <Phone size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                    <input className="fi" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder={t(lang, 'auth_ph_phone')}
                      style={{ height: 44, paddingLeft: 36 }} />
                  </div>
                </div>

                {/* Section : Adresse */}
                <div style={{ ...SECTION_STYLE, marginTop: 4 }}>
                  <MapPin size={12} /> {t(lang, 'auth_address')}
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{t(lang, 'auth_optional')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                    <input className="fi" value={address} onChange={e => setAddress(e.target.value)}
                      placeholder={t(lang, 'auth_ph_address')}
                      style={{ height: 44, paddingLeft: 36 }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 12 }}>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                      <input className="fi" value={city} onChange={e => setCity(e.target.value)}
                        placeholder={t(lang, 'auth_ph_city')}
                        style={{ height: 44, paddingLeft: 36 }} />
                    </div>
                    <div style={{ position: 'relative' }}>
                      <Hash size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                      <input className="fi" value={postal} onChange={e => setPostal(e.target.value)}
                        placeholder={t(lang, 'auth_ph_postal')}
                        style={{ height: 44, paddingLeft: 36 }} />
                    </div>
                  </div>
                </div>

                <div style={DIVIDER} />
              </>
            )}

            {/* ════════════════ EMAIL + PASSWORD ════════════════ */}
            {tab === 'signup' && (
              <div style={SECTION_STYLE}>
                <Mail size={12} /> {t(lang, 'auth_email')} & {t(lang, 'auth_pwd')}
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{t(lang, 'auth_required_fields')}</span>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              {tab === 'login' && <label style={LABEL_STYLE}>{t(lang, 'auth_email')}</label>}
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input type="email" className="fi" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  style={{ height: 44, paddingLeft: 36 }} />
              </div>
            </div>

            <div style={{ marginBottom: '24px', position: 'relative' }}>
              {tab === 'login' && <label style={LABEL_STYLE}>{t(lang, 'auth_pwd')}</label>}
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input type={showPw ? "text" : "password"} className="fi" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ height: 44, paddingLeft: 36, paddingRight: 44 }} />
                <button type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* ── Submit ──────────────────────────────────────── */}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="btn"
              style={{ width: '100%', height: 52, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={handleAuth} disabled={loading}>
              {loading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 18, height: 18, border: '2px solid rgba(0,0,0,0.3)', borderTop: '2px solid #000', borderRadius: '50%' }} />
              ) : (
                <>{tab === "login" ? t(lang, 'auth_btn_login') : t(lang, 'auth_btn_signup')} <ChevronRight size={18} /></>
              )}
            </motion.button>

            {/* ── OAuth ──────────────────────────────────────── */}
            <div className="oauth-grid" style={{ marginTop: 20 }}>
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
