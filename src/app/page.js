"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { Bot, CalendarDays, ClipboardList, MessageSquare, ShieldCheck, Star, ArrowRight, Zap, Lock, Globe, Check, X } from "lucide-react";
import TiltCard from "@/components/TiltCard";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { t } from "@/utils/i18n";
import InitialLangSelector from "@/components/InitialLangSelector";
import { useEffect, useState, useRef } from "react";
import { useUserStore } from "@/store/useUserStore";
import { supabase } from "@/utils/supabase/client";
import { AnimatePresence } from "framer-motion";

/* ─── Variants Framer Motion ─── */
const stagger = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.4 } }
};

const fadeUp = {
  hidden: { opacity: 0, y: 40, filter: "blur(10px)" },
  show:   { opacity: 1, y: 0,  filter: "blur(0px)", transition: { type: "spring", stiffness: 70, damping: 20 } }
};

const letterAnim = {
  hidden: { opacity: 0, y: 50 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  })
};

export default function Home() {
  const { user, setUser, credits, setCredits } = useUserStore();
  const [lang, setLang] = useState("fr");
  const [showLangSelector, setShowLangSelector] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const heroScale   = useTransform(scrollYProgress, [0, 0.8], [1, 0.95]);
  const heroY       = useTransform(scrollYProgress, [0, 1], ["0%", "35%"]);

  useEffect(() => {
    const saved = localStorage.getItem("site_lang");
    if (saved) {
      setLang(saved);
      document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";
    } else {
      setShowLangSelector(true);
    }

    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).single();
        if (profile) {
          setUser(profile);
          setCredits(profile.tokens);
        }
      }
    };
    loadUser();
  }, [setUser, setCredits]);

  const switchLang = (l) => {
    setLang(l);
    localStorage.setItem("site_lang", l);
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    setShowLangSelector(false);
  };

  const heroTitle = t(lang, "hero_title");
  const titleWords = heroTitle.split(" ");
  const lastTwoWords = titleWords.slice(-2).join(" ");
  const firstWords = titleWords.slice(0, -2).join(" ");

  return (
    <div style={{ overflowX: "hidden", background: "var(--bg)", minHeight: "100vh" }}>
      
      <AnimatePresence>
        {showLangSelector && (
          <InitialLangSelector onSelect={switchLang} />
        )}
      </AnimatePresence>
      {/* ── BACKGROUND AMBIANCE ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute", top: "-10%", left: "-10%", width: "50%", height: "50%",
            background: "radial-gradient(circle, var(--p) 0%, transparent 70%)", filter: "blur(120px)"
          }}
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute", bottom: "-10%", right: "-10%", width: "40%", height: "40%",
            background: "radial-gradient(circle, var(--a) 0%, transparent 70%)", filter: "blur(100px)"
          }}
        />
        <div style={{ position: "absolute", inset: 0, opacity: 0.02, backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')", filter: "contrast(150%) brightness(100%)" }} />
      </div>

      {/* ── NAVBAR ── */}
      <motion.header
        className="landing-header"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0,   opacity: 1 }}
        transition={{ type: "spring", stiffness: 50, damping: 15, delay: 0.2 }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: "var(--p-g)", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 20px rgba(89,130,255,0.4), inset 0 1px 0 rgba(255,255,255,0.2)"
            }}
          >
            <span style={{ fontSize: 20 }}>🎓</span>
          </motion.div>
          <span style={{ fontWeight: 800, fontFamily: "var(--font2)", fontSize: 18, letterSpacing: "-0.03em" }} className="mobile-hide-text">
            Moncef <span style={{ color: 'var(--a)' }}>IA</span>
          </span>
        </div>

        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          {user && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ fontSize: '11px', fontWeight: 900, color: 'var(--a)', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.15em' }}
            >
              <Zap size={11} fill="var(--a)" /> {['founder', 'moderator'].includes(user.role) ? 'Illimité' : `${credits} credits`}
            </motion.div>
          )}
          <Link href={user ? "/app" : "/auth"}>
            <motion.button className="btn btn-premium" style={{ minHeight: 44, padding: "0 28px" }}>
              {user ? t(lang, "dashboard") : t(lang, "access_app")} <ArrowRight size={16} />
            </motion.button>
          </Link>
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <LanguageSwitcher currentLang={lang} onSwitch={switchLang} />
        </div>
      </motion.header>

      {/* ── HERO ── */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="landing-section"
        id="hero"
      >
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "center",
          padding: "160px 24px 100px", textAlign: "center", position: "relative"
        }}>
          
          <motion.div variants={stagger} initial="hidden" animate="show" style={{ position: "relative", zIndex: 1, maxWidth: 1000 }}>
            
            {/* Badge */}
            <motion.div variants={fadeUp} style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(20px)", borderRadius: 99, padding: "10px 24px",
                fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)"
              }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
                  <Zap size={16} style={{ color: "var(--a)" }} />
                </motion.div>
                {t(lang, "hero_badge")}
                <span style={{
                  background: "var(--p-g)", borderRadius: 99, padding: "2px 10px", fontSize: 10, fontWeight: 900, color: "#fff"
                }}>NEW 3.5</span>
              </div>
            </motion.div>

            {/* Headline with Animation */}
            <motion.h1 style={{
              fontSize: "clamp(48px, 8vw, 102px)", lineHeight: 0.95, marginBottom: 32,
              fontFamily: "var(--font2)", fontWeight: 800, letterSpacing: "-0.051em"
            }}>
              <span style={{ color: "#fff", display: "inline-block" }}>
                {firstWords.split(" ").map((word, i) => (
                  <motion.span key={i} custom={i} variants={letterAnim} style={{ display: "inline-block", marginRight: "0.2em" }}>{word}</motion.span>
                ))}
              </span>
              <br />
              <motion.span
                initial={{ opacity: 0, scale: 0.9, filter: "blur(20px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ delay: 0.8, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  background: "linear-gradient(to right, #fff, var(--p), var(--a), #fff)",
                  backgroundSize: "300% 100%",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  display: "inline-block", paddingBottom: 12
                }}
              >
                {lastTwoWords}
              </motion.span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={fadeUp} style={{
              fontSize: "clamp(17px, 2.8vw, 22px)", color: "rgba(255,255,255,0.45)",
              maxWidth: 640, margin: "0 auto 56px", lineHeight: 1.6, fontWeight: 500
            }}>
              {t(lang, "hero_desc")}
            </motion.p>

            {/* CTA Container */}
            <motion.div variants={fadeUp} style={{ display: "flex", justifyContent: "center", gap: 20 }} className="hero-actions">
              <Link href="/auth?tab=signup">
                <motion.button className="btn btn-premium" style={{ fontSize: 17, padding: "18px 48px" }}>
                  {t(lang, "hero_btn_start")} <ArrowRight size={20} />
                </motion.button>
              </Link>
              <Link href="/auth?tab=login">
                <motion.button className="btn btn-ghost" style={{ fontSize: 17, padding: "18px 40px" }}>
                  {t(lang, "hero_btn_login")}
                </motion.button>
              </Link>
            </motion.div>

            {/* Trust Badges */}
            <motion.div variants={stagger} style={{ display: "flex", gap: 40, marginTop: 72, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { icon: Lock, text: "Infras. Militaire" },
                { icon: Zap, text: "Ultra Faible Latence" },
                { icon: Globe, text: "IA Multi-LLM" },
              ].map(({ icon: Icon, text }, i) => (
                <motion.div key={text} variants={fadeUp} style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 600 }}>
                  <Icon size={18} style={{ color: "var(--p)" }} />
                  {text}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ background: "rgba(0,0,0,0.2)", borderTop: "1px solid var(--border)" }}>
        <div className="landing-section">
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.8 }}
            style={{ textAlign: "center", marginBottom: 80 }}
          >
            <span style={{ background: "var(--p-g)", color: "#fff", fontSize: 12, fontWeight: 900, padding: "6px 16px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.1em" }}>ULTIMATE TOOLS</span>
            <h2 style={{ fontSize: "clamp(36px, 5vw, 64px)", marginTop: 24, letterSpacing: "-0.04em", fontFamily: "var(--font2)" }}>{t(lang, "feat_title")}</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 18, maxWidth: 600, margin: "16px auto 0" }}>{t(lang, "feat_desc")}</p>
          </motion.div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, maxWidth: 1300, margin: "0 auto" }}>
            <FeatureCard icon={<Bot size={28} />}          title="Moncef Intelligence" desc="L'épicentre de votre savoir. Une IA capable de comprendre vos cours, corriger vos travaux et expliquer les concepts les plus denses." list={["Analyse Sémantique", "Correction Prédictive", "Révisions Adaptatives"]} delay={0.1} />
            <FeatureCard icon={<CalendarDays size={28} />}  title="Flux Temporel IA"    desc="Oubliez la gestion manuelle. Votre emploi du temps s'auto-optimise selon vos priorités et vos cycles de concentration." list={["Semaines A/B Dynamiques", "Sync Cloud temps réel", "Alertes Neuronales"]} delay={0.2} />
            <FeatureCard icon={<ClipboardList size={28} />} title="Smart Tracker"     desc="Extraction automatique des devoirs depuis vos photos ou fichiers. Priorisation intelligente basée sur la complexité." list={["OCR Intégré", "Score de Priorité", "Rappels Adaptatifs"]} delay={0.3} />
            <FeatureCard icon={<MessageSquare size={28} />} title="Cortex Comm"        desc="Une messagerie chiffrée de bout en bout conçue pour la collaboration académique de haute intensité." list={["Salons de Travail", "DMs Sécurisés", "Partage de Données"]} delay={0.4} />
            <FeatureCard icon={<ShieldCheck size={28} />}   title="ALPHA ENGINE"       desc="L'interface d'administration ultime. Un contrôle total sur l'écosystème avec des analyses en temps réel." premium delay={0.5} list={["Console IA Directe", "Analytics Avancés", "Gestion Globale"]} />
            <FeatureCard icon={<Star size={28} />}          title="Modération 2.0"      desc="Des outils sophistiqués pour maintenir l'intégrité et la sécurité de la communauté Moncef IA." delay={0.6} list={["Safety Layer", "Gestion Rôles", "Logs d'Activité"]} />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.4)", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 32 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--p-g)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 24 }}>🎓</span></div>
            <span style={{ fontSize: 28, fontWeight: 900, fontFamily: "var(--font2)", letterSpacing: "-0.04em" }}>Moncef <span style={{ color: "var(--a)" }}>IA</span></span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, maxWidth: 400, margin: "0 auto 40px" }}>Propulsé par les dernières avancées en Intelligence Artificielle pour une éducation sans frontière.</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 40 }}>
            {["Confidentialité", "Termes", "API", "Status"].map(item => <span key={item} style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{item}</span>)}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em" }}>DESIGNED BY AMINE FJER • © 2026 MONCEF IA • ALL RIGHTS RESERVED</div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc, list, premium = false, delay }) {
  return (
    <TiltCard delay={delay} className="card" style={{ padding: "48px 32px", position: "relative", overflow: "hidden" }}>
      {premium && (
        <div style={{
          position: "absolute", top: 12, right: 12, background: "var(--gold)", color: "#000",
          fontSize: 10, fontWeight: 900, padding: "4px 12px", borderRadius: 99
        }}>PREMIUM</div>
      )}
      <div style={{ color: premium ? "var(--gold)" : "var(--p)", marginBottom: 28, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
          {icon}
        </div>
        <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font2)", letterSpacing: "-0.03em" }}>{title}</h3>
      </div>
      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>{desc}</p>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
        {list.map((item, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
            <Check size={14} style={{ color: "var(--a)" }} /> {item}
          </li>
        ))}
      </ul>
    </TiltCard>
  );
}

