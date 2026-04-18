"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { Bot, CalendarDays, ClipboardList, MessageSquare, ShieldCheck, Star, ArrowRight, Zap, Lock, Globe, Check, X } from "lucide-react";
import TiltCard from "@/components/TiltCard";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { t } from "@/utils/i18n";
import { useEffect, useState, useRef } from "react";
import { useUserStore } from "@/store/useUserStore";
import { supabase } from "@/utils/supabase/client";

/* ─── Variants Framer Motion ─── */
const stagger = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.2 } }
};
const fadeUp = {
  hidden: { opacity: 0, y: 28, filter: "blur(4px)" },
  show:   { opacity: 1, y: 0,  filter: "blur(0px)", transition: { type: "spring", stiffness: 90, damping: 18 } }
};
const fadeIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};

export default function Home() {
  const { user, setUser, credits, setCredits } = useUserStore();
  const [lang, setLang] = useState("fr");
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroY       = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);

  useEffect(() => {
    const saved = localStorage.getItem("site_lang");
    if (saved) {
      setLang(saved);
      document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";
    }

    // Load user session for tokens display
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          setUser(profile);
          setCredits(profile.tokens);
        }
      }
    };
    loadUser();
  }, []);

  const switchLang = (l) => {
    setLang(l);
    localStorage.setItem("site_lang", l);
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  };

  return (
    <div style={{ overflowX: "hidden", direction: lang === "ar" ? "rtl" : "ltr" }}>

      {/* ── NAVBAR PILL ── */}
      <motion.header
        className="landing-header"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0,   opacity: 1 }}
        transition={{ type: "spring", stiffness: 80, damping: 16, delay: 0.1 }}
      >
        {/* Colonne de gauche (Logo) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <div className="landing-logo" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <motion.div
              style={{
                width: 32, height: 32, borderRadius: 9,
                background: "linear-gradient(135deg, hsl(224,100%,62%), hsl(174,100%,41%))",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 14px rgba(89,130,255,0.3)"
              }}
            >
              <span style={{ fontSize: 16 }}>🎓</span>
            </motion.div>
            <span style={{ fontWeight: 800, fontFamily: "'Sora', sans-serif", fontSize: 16, visibility: 'visible', whiteSpace: 'nowrap' }} className="mobile-hide-text">
              Moncef <span style={{ color: 'var(--a)' }}>IA</span>
            </span>
          </div>
        </div>

        {/* Colonne du CENTRE (Le Bouton Principal + Tokens) */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
          {user && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ fontSize: '10px', fontWeight: 800, color: 'var(--a)', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
            >
              <Zap size={10} fill="var(--a)" /> {['founder', 'moderator'].includes(user.role) ? 'Illimité' : `${credits} cr.`}
            </motion.div>
          )}
          <Link href={user ? "/app" : "/auth"} style={{ display: "inline-flex" }}>
            <motion.button
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.96 }}
              className="btn"
              style={{ 
                minHeight: 38, padding: "8px 24px", fontSize: 13.5, borderRadius: 99, 
                whiteSpace: "nowrap", boxShadow: 'var(--glow-p)' 
              }}
            >
              {user ? t(lang, "dashboard") : t(lang, "access_app")} <ArrowRight size={14} />
            </motion.button>
          </Link>
        </div>

        {/* Colonne de droite (Sélecteur de Langues) */}
        <div style={{ flex: 1, display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
          <LanguageSwitcher currentLang={lang} onSwitch={switchLang} />
        </div>
      </motion.header>

      {/* ── HERO ── */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity }}
        id="hero"
      >
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "center",
          padding: "140px 24px 80px", textAlign: "center", position: "relative"
        }}>
          {/* Parallax orbs */}
          <motion.div style={{ y: heroY, position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.45, 0.25] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
                width: "60vw", height: "60vw", maxWidth: 700, maxHeight: 700,
                background: "radial-gradient(circle, rgba(89,130,255,0.2) 0%, rgba(0,208,178,0.12) 40%, transparent 70%)",
                filter: "blur(80px)", borderRadius: "50%"
              }}
            />
            <motion.div
              animate={{ scale: [1.1, 1, 1.1], opacity: [0.15, 0.3, 0.15] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
              style={{
                position: "absolute", bottom: "5%", right: "10%",
                width: "35vw", height: "35vw", maxWidth: 400,
                background: "radial-gradient(circle, rgba(138,58,255,0.2) 0%, transparent 70%)",
                filter: "blur(60px)", borderRadius: "50%"
              }}
            />
          </motion.div>

          <motion.div variants={stagger} initial="hidden" animate="show" style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>

            {/* Badge */}
            <motion.div variants={fadeUp} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.035)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(20px)",
                borderRadius: 99, padding: "8px 18px",
                fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)"
              }}>
                <Zap size={14} style={{ color: "hsl(174,100%,55%)" }} />
                {t(lang, "hero_badge")}
                <span style={{
                  background: "linear-gradient(135deg, hsl(224,100%,62%), hsl(174,100%,41%))",
                  borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700, color: "#fff"
                }}>NEW</span>
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1 variants={fadeUp} style={{
              fontSize: "clamp(44px, 7.5vw, 88px)",
              lineHeight: 1.03, marginBottom: 28,
              fontFamily: "'Sora', sans-serif", fontWeight: 800,
              letterSpacing: "-0.04em",
              textShadow: "0 2px 40px rgba(0,0,0,0.3)"
            }}>
              <span style={{ color: "#fff" }}>{t(lang, "hero_title").split(" ").slice(0, -2).join(" ")}</span>
              {" "}
              <span style={{
                background: "linear-gradient(135deg, hsl(224,100%,72%) 0%, hsl(174,100%,60%) 50%, hsl(263,90%,75%) 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                display: "inline-block", paddingBottom: 8
              }}>
                {t(lang, "hero_title").split(" ").slice(-2).join(" ")}
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={fadeUp} style={{
              fontSize: "clamp(16px, 2.5vw, 20px)",
              color: "rgba(255,255,255,0.52)",
              maxWidth: 580, margin: "0 auto 48px",
              lineHeight: 1.7, fontWeight: 400
            }}>
              {t(lang, "hero_desc")}
            </motion.p>

            {/* CTA Pill Group */}
            <motion.div variants={fadeUp} className="hero-actions">
              <div style={{
                display: "inline-flex", alignItems: "center",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                borderRadius: 99, padding: 6,
                boxShadow: "0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
                flexWrap: "wrap", justifyContent: "center"
              }} className="hero-pill-container">
                <Link href="/auth?tab=signup" style={{ textDecoration: "none" }}>
                  <motion.div
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    style={{
                      background: "linear-gradient(135deg, hsl(224,100%,60%) 0%, hsl(174,100%,40%) 100%)",
                      color: "#fff", padding: "14px 32px",
                      borderRadius: 99, fontWeight: 700, fontSize: 15,
                      boxShadow: "0 4px 20px rgba(89,130,255,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
                      display: "flex", alignItems: "center", gap: 8,
                      letterSpacing: "-0.01em"
                    }}
                  >
                    {t(lang, "hero_btn_start")} <ArrowRight size={16} />
                  </motion.div>
                </Link>
                <Link href="/auth?tab=login" style={{ textDecoration: "none" }}>
                  <motion.div
                    whileHover={{ background: "rgba(255,255,255,0.07)" }}
                    style={{
                      color: "rgba(255,255,255,0.75)", padding: "14px 28px",
                      borderRadius: 99, fontWeight: 600, fontSize: 15,
                      transition: "background 0.25s ease", letterSpacing: "-0.01em"
                    }}
                  >
                    {t(lang, "hero_btn_login")}
                  </motion.div>
                </Link>
              </div>
            </motion.div>

            {/* Trust row */}
            <motion.div variants={fadeIn} style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 24, marginTop: 48, flexWrap: "wrap"
            }}>
              {[
                { icon: Lock, text: "100% sécurisé" },
                { icon: Zap, text: "Ultra rapide" },
                { icon: Globe, text: "Multi-langue" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  color: "rgba(255,255,255,0.38)", fontSize: 13, fontWeight: 500
                }}>
                  <Icon size={14} style={{ color: "rgba(89,130,255,0.7)" }} />
                  {text}
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* ── FEATURES ── */}
      <section id="features" style={{
        background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.2) 20%, rgba(0,0,0,0.2) 80%, transparent 100%)",
        borderTop: "1px solid rgba(255,255,255,0.04)"
      }}>
        <div className="landing-section" style={{ paddingTop: 90 }}>
          <motion.div
            initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <span style={{
                background: "rgba(89,130,255,0.15)", border: "1px solid rgba(89,130,255,0.25)",
                color: "hsl(224,100%,75%)", fontSize: 11.5, fontWeight: 700,
                padding: "5px 14px", borderRadius: 99, letterSpacing: "0.06em", textTransform: "uppercase"
              }}>FONCTIONNALITÉS</span>
            </div>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 50px)", marginBottom: 14, letterSpacing: "-0.04em" }}>
              {t(lang, "feat_title")}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 64, fontSize: 17, maxWidth: 520, margin: "0 auto 64px" }}>
              {t(lang, "feat_desc")}
            </p>
          </motion.div>

          <div className="features-grid">
            <FeatureCard icon={<Bot size={24} />}          title="Moncef IA"         desc="Assistance pédagogique complète avec explications détaillées et corrections personnalisées." list={["Réponses intelligentes 24/7", "Explications détaillées", "Corrections instantanées", "Révisions personnalisées"]} delay={0.05} />
            <FeatureCard icon={<CalendarDays size={24} />}  title="Emploi de Temps IA" desc="Gestion intelligente de votre emploi du temps avec synchronisation automatique." list={["Semaines A/B automatiques", "Synchronisation temps réel", "Rappels intelligents", "Impression facile"]} delay={0.1} />
            <FeatureCard icon={<ClipboardList size={24} />} title="Homework Tracker"   desc="Suivi complet de vos devoirs avec analyse IA et rappels automatiques." list={["Extraction automatique", "Priorités intelligentes", "Rappels avant échéance", "Historique complet"]} delay={0.15} />
            <FeatureCard icon={<MessageSquare size={24} />} title="Communication"      desc="Plateforme de messagerie ultra-sécurisée pour collaborer avec vos camarades." list={["Messagerie instantanée", "Groupes & DMs", "Profils utilisateurs", "Notifications temps réel"]} delay={0.2} />
            <FeatureCard icon={<ShieldCheck size={24} />}   title="ALPHA AI"           desc="IA exclusive au Fondateur pour la gestion avancée du site en temps réel." list={["Gestion complète du site", "Analyse des données", "Notifications globales", "Contrôle utilisateurs"]} premium delay={0.25} />
            <FeatureCard icon={<Star size={24} />}          title="Modération"         desc="Outils de gestion communautaire pour les modérateurs et administrateurs." list={["Gestion utilisateurs", "Modération contenu", "Rapports d'activité", "Sécurité renforcée"]} delay={0.3} />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works">
        <div className="landing-section">
          <motion.div
            initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <span style={{
                background: "rgba(0,208,178,0.12)", border: "1px solid rgba(0,208,178,0.22)",
                color: "hsl(174,100%,60%)", fontSize: 11.5, fontWeight: 700,
                padding: "5px 14px", borderRadius: 99, letterSpacing: "0.06em", textTransform: "uppercase"
              }}>COMMENT ÇA MARCHE</span>
            </div>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 50px)", marginBottom: 14, letterSpacing: "-0.04em" }}>
              {t(lang, "hw_title")}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 64, fontSize: 17, maxWidth: 520, margin: "0 auto 64px" }}>
              {t(lang, "hw_desc")}
            </p>
          </motion.div>

          <div className="steps-grid">
            {[
              { n: "01", title: "Créer ton compte",       desc: "Inscris-toi gratuitement en quelques secondes avec ton email ou OAuth." },
              { n: "02", title: "Brancher ton EDT",       desc: "Importe ou crée ton emploi du temps avec l'aide de Moncef IA." },
              { n: "03", title: "Laisser l'IA travailler", desc: "Laisse Moncef IA gérer tes devoirs et t'assister dans tes études." },
              { n: "04", title: "Progresser ensemble",    desc: "Collabore avec tes camarades et suivis ta progression en temps réel." },
            ].map(({ n, title, desc }, i) => (
              <TiltCard key={n} delay={i * 0.08} className="step-card card">
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "linear-gradient(135deg, hsl(224,100%,62%), hsl(174,100%,41%))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 22px", boxShadow: "0 6px 22px rgba(89,130,255,0.4)",
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15, color: "#fff"
                }}>{n}</div>
                <h3 style={{ color: "hsl(174,100%,60%)", fontSize: 19, marginBottom: 12, fontWeight: 700, letterSpacing: "-0.03em" }}>{title}</h3>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.65 }}>{desc}</p>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIERS ── */}
      <section id="tiers" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.15)" }}>
        <div className="landing-section">
          <motion.div
            initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <span style={{
                background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.22)",
                color: "hsl(45,100%,65%)", fontSize: 11.5, fontWeight: 700,
                padding: "5px 14px", borderRadius: 99, letterSpacing: "0.06em", textTransform: "uppercase"
              }}>RANGS & ACCÈS</span>
            </div>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 50px)", marginBottom: 14, letterSpacing: "-0.04em" }}>
              {t(lang, "ti_title")}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 64, fontSize: 17, maxWidth: 520, margin: "0 auto 64px" }}>
              {t(lang, "ti_desc")}
            </p>
          </motion.div>

          <div className="tiers-grid">
            <TierCard tier={3} title="Casque Bronze"  desc="Accès standard avec 100 crédits/jour régénérés toutes les 2 heures." list={["Accès à Moncef IA", "Emploi du temps", "Suivi des devoirs", "Messagerie"]} cross={["ALPHA AI"]} delay={0.05} />
            <TierCard tier={2} title="Casque Argent"  desc="Modérateur avec accès illimité et crédits infinis pour modérer." list={["Tout du Bronze", "Crédits illimités", "Gestion utilisateurs", "Modération"]} cross={["ALPHA AI"]} delay={0.15} />
            <TierCard tier={1} title="Casque Or"      desc="Co-fondateur avec accès complet et contrôle total du site (max 2)." list={["Tout du Modérateur", "ALPHA AI Exclusif", "Gestion complète", "Analytics avancées", "Notifications globales"]} premium delay={0.25} />
          </div>
        </div>
      </section>

      {/* ── INFRA ── */}
      <section id="infrastructure" style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(89,130,255,0.08) 0%, transparent 70%)"
        }} />
        <div className="landing-section" style={{ position: "relative", zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.93 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 style={{
              fontSize: "clamp(36px, 5vw, 62px)",
              textTransform: "uppercase", letterSpacing: "0.06em",
              background: "linear-gradient(135deg, #fff 0%, hsl(174,100%,60%) 50%, hsl(224,100%,72%) 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              marginBottom: 16
            }}>{t(lang, "sec_title")}</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 18, maxWidth: 540, margin: "0 auto 60px", fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}>{t(lang, "sec_desc")}</p>
          </motion.div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, maxWidth: 960, margin: "0 auto", textAlign: "left" }}>
            <InfraCard
              delay={0.1}
              icon={<ShieldCheck size={28} />}
              iconColor="hsl(174,100%,55%)"
              title="Supabase Auth"
              borderColor="rgba(0,208,178,0.2)"
              glowColor="rgba(0,208,178,0.1)"
              items={["Row Level Security (RLS) Actif", "OAuth Google Haute Performance", "Base de Données PostgreSQL"]}
              checkColor="hsl(174,100%,55%)"
            >
              Notre base de données de niveau entreprise vous garantit que vos créations et vos notes sont toujours protégées et encryptées.
            </InfraCard>

            <InfraCard
              delay={0.2}
              icon={<Star size={28} />}
              iconColor="hsl(224,100%,72%)"
              title="Cloudflare Edge"
              borderColor="rgba(89,130,255,0.2)"
              glowColor="rgba(89,130,255,0.08)"
              items={["Réseau Global Anycast CDN", "Protection L7 DDoS Garantie", "AI Proxy Workers Sécurisés"]}
              checkColor="hsl(224,100%,72%)"
            >
              Le moteur d'Intelligence Artificielle est propulsé via le réseau mondial de Cloudflare, le rendant insensible à toute surcharge.
            </InfraCard>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.5)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: "-0.04em" }}>
            <span>🎓</span>
            <span>Moncef <span style={{ background: "linear-gradient(135deg, hsl(224,100%,72%), hsl(174,100%,55%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>IA</span></span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
            Créé avec passion par <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Amine FJER</span>. © 2026 Tous droits réservés.
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {["Confidentialité", "CGU", "Contact"].map(link => (
              <span key={link} style={{ padding: "4px 12px", fontSize: 12, color: "rgba(255,255,255,0.3)", cursor: "pointer", borderRadius: 99, transition: "color 0.2s" }}
                onMouseEnter={e => e.target.style.color = "rgba(255,255,255,0.7)"}
                onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.3)"}
              >{link}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Feature Card ─── */
function FeatureCard({ icon, title, desc, list, premium = false, delay }) {
  return (
    <TiltCard delay={delay} className={`feature-card card-hover ${premium ? "" : ""}`} style={{
      padding: "30px 28px",
      background: premium
        ? "linear-gradient(145deg, rgba(255,215,0,0.06) 0%, rgba(255,165,0,0.02) 100%)"
        : "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
      border: premium ? "1px solid rgba(255,215,0,0.15)" : undefined
    }}>
      {premium && <div className="premium-badge">ALPHA</div>}
      <div className="feature-icon" style={{ color: premium ? "hsl(45,100%,65%)" : "hsl(224,100%,72%)" }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 18, color: premium ? "hsl(45,100%,70%)" : "#fff", marginBottom: 10, fontWeight: 700, letterSpacing: "-0.03em" }}>{title}</h3>
      <p style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 20, fontSize: 13.5 }}>{desc}</p>
      <ul className="feature-list">
        {list.map((item, i) => (
          <li key={i}>
            <Check size={13} style={{ color: premium ? "hsl(45,100%,65%)" : "hsl(174,100%,55%)", flexShrink: 0 }} />
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{item}</span>
          </li>
        ))}
      </ul>
    </TiltCard>
  );
}

/* ─── Tier Card ─── */
function TierCard({ tier, title, desc, list, cross = [], premium = false, delay }) {
  const color = premium ? "hsl(45,100%,65%)" : tier === 2 ? "hsl(220,70%,72%)" : "hsl(174,100%,55%)";
  const silver = tier === 2;
  return (
    <TiltCard delay={delay} className="feature-card card-hover" style={{
      padding: "40px 28px",
      background: premium
        ? "linear-gradient(145deg, rgba(255,215,0,0.07) 0%, rgba(255,150,0,0.03) 100%)"
        : silver
          ? "linear-gradient(145deg, rgba(100,130,255,0.06), rgba(255,255,255,0.01))"
          : "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
      border: `1px solid ${premium ? "rgba(255,215,0,0.15)" : silver ? "rgba(100,130,255,0.1)" : "rgba(255,255,255,0.06)"}`,
      position: "relative"
    }}>
      {premium && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: "linear-gradient(90deg, hsl(45,100%,65%), hsl(30,100%,60%))",
          borderRadius: "22px 22px 0 0"
        }} />
      )}
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: `rgba(255,255,255,0.04)`, border: `2px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, fontWeight: 800, margin: "0 auto 20px", color,
        boxShadow: `0 0 20px ${color}30`
      }}>
        {premium ? "👑" : tier === 2 ? "🛡️" : "🪖"}
      </div>
      <h3 style={{ fontSize: 22, color, marginBottom: 10, fontWeight: 700, letterSpacing: "-0.03em" }}>{title}</h3>
      <p style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 28, fontSize: 13.5 }}>{desc}</p>
      <ul className="feature-list" style={{ textAlign: "left" }}>
        {list.map((item, i) => (
          <li key={i}>
            <Check size={13} style={{ color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.72)" }}>{item}</span>
          </li>
        ))}
        {cross.map((item, i) => (
          <li key={`x${i}`} style={{ opacity: 0.4 }}>
            <X size={13} style={{ color: "hsl(0,80%,60%)", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{item}</span>
          </li>
        ))}
      </ul>
    </TiltCard>
  );
}

/* ─── Infra Card ─── */
function InfraCard({ icon, iconColor, title, borderColor, glowColor, items, checkColor, delay, children }) {
  return (
    <TiltCard delay={delay} className="card-hover" style={{
      padding: "36px 32px", borderRadius: 24,
      background: `linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))`,
      border: `1px solid ${borderColor}`,
      boxShadow: `0 20px 50px ${glowColor}, 0 4px 16px rgba(0,0,0,0.2)`
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: `${glowColor}`,
          border: `1px solid ${borderColor}`,
          display: "flex", alignItems: "center", justifyContent: "center", color: iconColor
        }}>{icon}</div>
        <h3 style={{ fontSize: 22, color: "#fff", fontWeight: 700, letterSpacing: "-0.03em" }}>{title}</h3>
      </div>
      <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.65, marginBottom: 22, fontSize: 14 }}>{children}</p>
      <ul className="feature-list">
        {items.map((item, i) => (
          <li key={i}>
            <Check size={13} style={{ color: checkColor, flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)" }}>{item}</span>
          </li>
        ))}
      </ul>
    </TiltCard>
  );
}
