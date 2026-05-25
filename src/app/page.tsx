"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { Bot, CalendarDays, ClipboardList, MessageSquare, ShieldCheck, Star, ArrowRight, Zap, Lock, Globe, Check, X, Crown, Shield, Database } from "lucide-react";
import { t } from "@/utils/i18n";
import { Suspense, useEffect, useState, useRef } from "react";
import { useUserStore } from "@/store/useUserStore";
import { supabase } from "@/utils/supabase/client";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";

const TiltCard = dynamic(() => import("@/components/TiltCard"), { ssr: false, loading: () => <Skeleton className="w-[320px] h-[300px] rounded-2xl" /> });
const InitialLangSelector = dynamic(() => import("@/components/InitialLangSelector"), { ssr: false });
const LanguageSwitcher = dynamic(() => import("@/components/LanguageSwitcher"), { ssr: false });

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ─── Variants Framer Motion ─── */
const stagger: any = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.4 } }
};

const fadeUp: any = {
  hidden: { opacity: 0, y: 40, filter: "blur(10px)" },
  show:   { opacity: 1, y: 0,  filter: "blur(0px)", transition: { type: "spring", stiffness: 70, damping: 20 } }
};

const letterAnim: any = {
  hidden: { opacity: 0, y: 50 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  })
};

export default function Home() {
  const { user, setUser, credits, setCredits } = useUserStore();
  const [lang, setLang] = useState("fr");
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const heroScale   = useTransform(scrollYProgress, [0, 0.8], [1, 0.95]);

  useEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from(".card-gsap", {
        scrollTrigger: {
          trigger: ".features-container",
          start: "top bottom-=100px",
          stagger: 0.15,
        },
        y: 100,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out"
      });
    }, featuresRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("site_lang");
    if (saved) {
      setLang(saved);
      document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";
    } else {
      setShowLangSelector(true);
    }

    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).single();
          if (profile) {
            setUser(profile);
            setCredits(profile.tokens);
          }
        }
      } catch (err) {
        console.error("Error loading user:", err);
      } finally {
        setLoading(false);
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
          {loading ? (
            <div className="flex flex-col items-center gap-2">
               <Skeleton className="w-24 h-4 rounded-full bg-white/10" />
               <Skeleton className="w-32 h-10 rounded-full bg-white/10" />
            </div>
          ) : user ? (
            <>
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ fontSize: '11px', fontWeight: 900, color: 'var(--a)', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.15em' }}
              >
                <Zap size={11} fill="var(--a)" /> {['founder', 'moderator'].includes(user.role) ? 'Illimité' : `${credits} credits`}
              </motion.div>
              <Link href="/app" className="btn btn-premium" style={{ minHeight: 44, padding: "0 28px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                {t(lang, "dashboard")} <ArrowRight size={16} />
              </Link>
            </>
          ) : (
             <Link href="/auth" className="btn btn-premium" style={{ minHeight: 44, padding: "0 28px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
              {t(lang, "access_app")} <ArrowRight size={16} />
            </Link>
          )}
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
                  <span key={i} style={{ display: "inline-block" }}>
                    <motion.span custom={i} variants={letterAnim} style={{ display: "inline-block" }}>{word}</motion.span>
                    {" "}
                  </span>
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
              <Link href="/auth?tab=signup" className="btn btn-premium" style={{ fontSize: 17, padding: "18px 48px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                {t(lang, "hero_btn_start")} <ArrowRight size={20} />
              </Link>
              <Link href="/auth?tab=login" className="btn btn-ghost" style={{ fontSize: 17, padding: "18px 40px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                {t(lang, "hero_btn_login")}
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
      <section id="features" ref={featuresRef} style={{ background: "rgba(0,0,0,0.2)", borderTop: "1px solid var(--border)" }}>
        <div className="landing-section features-container">
          <div style={{ textAlign: "center", marginBottom: 80 }}>
            <span style={{ background: "var(--p-g)", color: "#fff", fontSize: 12, fontWeight: 900, padding: "6px 16px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.1em" }}>ULTIMATE TOOLS</span>
            <h2 style={{ fontSize: "clamp(36px, 5vw, 64px)", marginTop: 24, letterSpacing: "-0.04em", fontFamily: "var(--font2)" }}>{t(lang, "feat_title")}</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 18, maxWidth: 600, margin: "16px auto 0" }}>{t(lang, "feat_desc")}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, maxWidth: 1300, margin: "0 auto" }}>
            {(() => {
              const featuresData = {
                fr: [
                  { icon: <Bot size={28} />, title: "Moncef Intelligence", desc: "L'épicentre de votre savoir. Une IA capable de comprendre vos cours, corriger vos travaux et expliquer les concepts les plus denses.", list: ["Analyse Sémantique", "Correction Prédictive", "Révisions Adaptatives"] },
                  { icon: <CalendarDays size={28} />, title: "Flux Temporel IA", desc: "Oubliez la gestion manuelle. Votre emploi du temps s'auto-optimise selon vos priorités et vos cycles de concentration.", list: ["Semaines A/B Dynamiques", "Sync Cloud temps réel", "Alertes Neuronales"] },
                  { icon: <ClipboardList size={28} />, title: "Smart Tracker", desc: "Extraction automatique des devoirs depuis vos photos ou fichiers. Priorisation intelligente basée sur la complexité.", list: ["OCR Intégré", "Score de Priorité", "Rappels Adaptatifs"] },
                  { icon: <MessageSquare size={28} />, title: "Cortex Comm", desc: "Une messagerie chiffrée de bout en bout conçue pour la collaboration académique de haute intensité.", list: ["Salons de Travail", "DMs Sécurisés", "Partage de Données"] },
                  { icon: <ShieldCheck size={28} />, title: "ALPHA ENGINE", desc: "L'interface d'administration ultime. Un contrôle total sur l'écosystème avec des analyses en temps réel.", premium: true, list: ["Console IA Directe", "Analytics Avancés", "Gestion Globale"] },
                  { icon: <Star size={28} />, title: "Modération 2.0", desc: "Des outils sophistiqués pour maintenir l'intégrité et la sécurité de la communauté Moncef IA.", list: ["Safety Layer", "Gestion Rôles", "Logs d'Activité"] }
                ],
                en: [
                  { icon: <Bot size={28} />, title: "Moncef Intelligence", desc: "The epicenter of your knowledge. An AI capable of understanding your courses, correcting your work and explaining the densest concepts.", list: ["Semantic Analysis", "Predictive Correction", "Adaptive Revisions"] },
                  { icon: <CalendarDays size={28} />, title: "AI Time Flow", desc: "Forget manual management. Your schedule auto-optimizes according to your priorities and concentration cycles.", list: ["Dynamic A/B Weeks", "Real-time Cloud Sync", "Neural Alerts"] },
                  { icon: <ClipboardList size={28} />, title: "Smart Tracker", desc: "Automatic homework extraction from your photos or files. Intelligent prioritization based on complexity.", list: ["Integrated OCR", "Priority Score", "Adaptive Reminders"] },
                  { icon: <MessageSquare size={28} />, title: "Cortex Comm", desc: "End-to-end encrypted messaging designed for high-intensity academic collaboration.", list: ["Work Rooms", "Secure DMs", "Data Sharing"] },
                  { icon: <ShieldCheck size={28} />, title: "ALPHA ENGINE", desc: "The ultimate administration interface. Total control over the ecosystem with real-time analytics.", premium: true, list: ["Direct AI Console", "Advanced Analytics", "Global Management"] },
                  { icon: <Star size={28} />, title: "Moderation 2.0", desc: "Sophisticated tools to maintain the integrity and security of the Moncef IA community.", list: ["Safety Layer", "Role Management", "Activity Logs"] }
                ],
                es: [
                  { icon: <Bot size={28} />, title: "Moncef Intelligence", desc: "El epicentro de tu conocimiento. Una IA capaz de entender tus cursos, corregir tus trabajos y explicar los conceptos más densos.", list: ["Análisis Semántico", "Corrección Predictiva", "Revisiones Adaptativas"] },
                  { icon: <CalendarDays size={28} />, title: "Flujo Temporal IA", desc: "Olvida la gestión manual. Tu horario se auto-optimiza según tus prioridades y ciclos de concentración.", list: ["Semanas A/B Dinámicas", "Sincronización en la Nube", "Alertas Neuronales"] },
                  { icon: <ClipboardList size={28} />, title: "Smart Tracker", desc: "Extracción automática de tareas desde tus fotos o archivos. Priorización inteligente basada en la complejidad.", list: ["OCR Integrado", "Puntuación de Prioridad", "Recordatorios Adaptativos"] },
                  { icon: <MessageSquare size={28} />, title: "Cortex Comm", desc: "Mensajería encriptada de extremo a extremo diseñada para una colaboración académica de alta intensidad.", list: ["Salas de Trabajo", "MDs Seguros", "Intercambio de Datos"] },
                  { icon: <ShieldCheck size={28} />, title: "ALPHA ENGINE", desc: "La interfaz de administración definitiva. Control total sobre el ecosistema con análisis en tiempo real.", premium: true, list: ["Consola IA Directa", "Analíticas Avanzadas", "Gestión Global"] },
                  { icon: <Star size={28} />, title: "Moderación 2.0", desc: "Herramientas sofisticadas para mantener la integridad y seguridad de la comunidad Moncef IA.", list: ["Capa de Seguridad", "Gestión de Roles", "Registros de Actividad"] }
                ],
                ar: [
                  { icon: <Bot size={28} />, title: "ذكاء منصف", desc: "مركز معرفتك. ذكاء اصطناعي قادر على فهم دروسك وتصحيح أعمالك وشرح أعقد المفاهيم.", list: ["تحليل دلالي", "تصحيح تنبؤي", "مراجعات تكيفية"] },
                  { icon: <CalendarDays size={28} />, title: "تدفق زمني ذكي", desc: "انسَ الإدارة اليدوية. يتم تحسين جدولك تلقائياً وفقاً لأولوياتك ودورات تركيزك.", list: ["أسابيع أ/ب ديناميكية", "مزامنة سحابية فورية", "تنبيهات عصبية"] },
                  { icon: <ClipboardList size={28} />, title: "تتبع ذكي", desc: "استخراج تلقائي للواجبات من صورك أو ملفاتك. تحديد الأولويات بذكاء بناءً على التعقيد.", list: ["تعرف بصري متكامل", "نقاط الأولوية", "تذكيرات تكيفية"] },
                  { icon: <MessageSquare size={28} />, title: "اتصالات كورتيكس", desc: "مراسلة مشفرة من البداية للنهاية مصممة للتعاون الأكاديمي عالي الكثافة.", list: ["غرف عمل", "رسائل خاصة آمنة", "مشاركة البيانات"] },
                  { icon: <ShieldCheck size={28} />, title: "محرك ألفا", desc: "واجهة الإدارة المطلقة. تحكم كامل في النظام البيئي مع تحليلات في الوقت الفعلي.", premium: true, list: ["وحدة تحكم ذكاء مباشر", "تحليلات متقدمة", "إدارة شاملة"] },
                  { icon: <Star size={28} />, title: "إشراف 2.0", desc: "أدوات متطورة للحفاظ على نزاهة وأمان مجتمع ذكاء منصف.", list: ["طبقة أمان", "إدارة الأدوار", "سجلات النشاط"] }
                ],
                zh: [
                  { icon: <Bot size={28} />, title: "Moncef 智能", desc: "知识的核心。能够理解您的课程、批改作业并解释最复杂的概念的AI。", list: ["语义分析", "预测性批改", "适应性复习"] },
                  { icon: <CalendarDays size={28} />, title: "AI 时间流", desc: "忘记手动管理。您的日程会根据您的优先级和专注周期自动优化。", list: ["动态 A/B 周", "实时云同步", "神经警报"] },
                  { icon: <ClipboardList size={28} />, title: "智能追踪器", desc: "从照片或文件中自动提取作业。基于复杂度的智能优先级排序。", list: ["集成 OCR", "优先级得分", "适应性提醒"] },
                  { icon: <MessageSquare size={28} />, title: "Cortex 通信", desc: "专为高强度学术合作设计的端到端加密消息传递。", list: ["工作区", "安全私信", "数据共享"] },
                  { icon: <ShieldCheck size={28} />, title: "ALPHA 引擎", desc: "终极管理界面。通过实时分析全面控制生态系统。", premium: true, list: ["直接 AI 控制台", "高级分析", "全局管理"] },
                  { icon: <Star size={28} />, title: "审核 2.0", desc: "维护 Moncef IA 社区完整性和安全性的高级工具。", list: ["安全层", "角色管理", "活动日志"] }
                ]
              };
              
              const currentFeatures = (featuresData as any)[lang] || featuresData.fr;
              
              return currentFeatures.map((feat: any, idx: number) => (
                <FeatureCard 
                  key={idx} 
                  icon={feat.icon} 
                  title={feat.title} 
                  desc={feat.desc} 
                  list={feat.list} 
                  premium={feat.premium} 
                  delay={0.1 + (idx * 0.1)} 
                />
              ));
            })()}
          </div>
        </div>
      </section>

      {/* ── NIVEAUX DE COMPTE & TECH STACK ── */}
      <section id="tiers-tech" style={{ padding: "100px 24px", background: "rgba(0,0,0,0.3)", borderTop: "1px solid var(--border)", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 70 }}>
            <span style={{ background: "var(--p-g)", color: "#fff", fontSize: 12, fontWeight: 900, padding: "6px 16px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Écosystème & Grades
            </span>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", marginTop: 20, fontFamily: "var(--font2)", letterSpacing: "-0.03em" }}>
              Niveaux de Grade & Infrastructure
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, maxWidth: 600, margin: "12px auto 0" }}>
              Découvrez la hiérarchie des permissions de la communauté Moncef IA et l'infrastructure technologique ultra-sécurisée qui propulse l'application.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 40 }}>
            
            {/* Column 1: Account Tiers (Grades) */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 24, padding: 36, display: "flex", flexDirection: "column", gap: 24 }}
            >
              <h3 style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font2)", display: "flex", alignItems: "center", gap: 12 }}>
                <Crown size={24} style={{ color: "var(--gold)" }} /> Grades & Privilèges
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Utilisateur Normal */}
                <div style={{ background: "rgba(255,255,255,0.02)", padding: 20, borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>👤</span>
                    <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Utilisateur Normal</h4>
                    <span style={{ marginLeft: "auto", fontSize: 11, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>700 cr.</span>
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.5 }}>
                    Accès à l'IA pédagogique, gestion de l'emploi du temps individuel (Semaines A/B), messagerie cryptée et suivi des devoirs. Crédits rechargés périodiquement.
                  </p>
                </div>

                {/* Modérateur */}
                <div style={{ background: "rgba(167,139,250,0.03)", padding: 20, borderRadius: 16, border: "1px solid rgba(167,139,250,0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>🛡️</span>
                    <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#a78bfa" }}>Modérateur</h4>
                    <span style={{ marginLeft: "auto", fontSize: 11, background: "rgba(167,139,250,0.15)", color: "#c084fc", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>Illimité</span>
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.5 }}>
                    Accès à la console d'administration ALPHA. Privilèges de modération : modification des profils utilisateurs (sauf Fondateur) et suppression des devoirs/contenus abusifs pour maintenir l'intégrité de la communauté.
                  </p>
                </div>

                {/* Fondateur */}
                <div style={{ background: "rgba(255,215,0,0.03)", padding: 20, borderRadius: 16, border: "1px solid rgba(255,215,0,0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>👑</span>
                    <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--gold)" }}>Fondateur Alpha</h4>
                    <span style={{ marginLeft: "auto", fontSize: 11, background: "rgba(255,215,0,0.15)", color: "var(--gold)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>Propriétaire</span>
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.5 }}>
                    Contrôle absolu sur l'écosystème. Privilèges d'administration globaux, consultation des statistiques de base de données en temps réel, réinitialisation de tokens, édition de rôles (promotions de modérateurs) et console de commande IA directe.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Column 2: Tech Stack (Supabase, Cloudflare, etc.) */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 24, padding: 36, display: "flex", flexDirection: "column", gap: 24 }}
            >
              <h3 style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font2)", display: "flex", alignItems: "center", gap: 12 }}>
                <Zap size={24} style={{ color: "var(--a)" }} /> Technologies & Outils
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Supabase */}
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(0,210,182,0.05)", border: "1px solid rgba(0,210,182,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--a)", flexShrink: 0 }}>
                    <Database size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px 0", color: "#fff" }}>Supabase (PostgreSQL & Realtime)</h4>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.4 }}>
                      Base de données sécurisée. Authentification par jeton JWT et RLS (Row Level Security) garantissant la confidentialité absolue des données utilisateur. Abonnements WebSocket Postgres pour la synchronisation des calendriers et messages en temps réel sans latence.
                    </p>
                  </div>
                </div>

                {/* Cloudflare */}
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f97316", flexShrink: 0 }}>
                    <Globe size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px 0", color: "#fff" }}>Cloudflare Security & CDN</h4>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.4 }}>
                      Couverture réseau mondiale et résolution DNS ultra-rapide. Protection anti-DDoS robuste, WAF (Web Application Firewall) bloquant le trafic malveillant et chiffrement SSL/TLS de bout en bout pour une sécurité impénétrable.
                    </p>
                  </div>
                </div>

                {/* Multi-LLM Gateway */}
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(89,130,255,0.05)", border: "1px solid rgba(89,130,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--p)", flexShrink: 0 }}>
                    <Bot size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px 0", color: "#fff" }}>Passerelle Multi-LLM Hybride</h4>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.4 }}>
                      Intégration dynamique des modèles Claude 3.5 Sonnet (Anthropic), Gemini 2.5 Flash (Google) et Llama 3.3 (Meta) via des APIs sécurisées et tolérantes aux pannes pour le traitement intelligent des requêtes et l'OCR d'images.
                    </p>
                  </div>
                </div>

                {/* Next.js & Framer Motion */}
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
                    <Lock size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px 0", color: "#fff" }}>Next.js (App Router) & Framer Motion</h4>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.4 }}>
                      Architecture moderne avec rendu hybride pour des performances maximales. Animations fluides et transitions d'état animées par Framer Motion à 60 images par seconde pour une expérience utilisateur premium.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

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
            {[
              { name: "Confidentialité", href: "/privacy" },
              { name: "Termes", href: "/terms" },
              { name: "API", href: "/api-docs" },
              { name: "Status", href: "/status" }
            ].map(item => (
              <Link key={item.name} href={item.href} style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600, fontSize: 13, textDecoration: "none", transition: "color 0.2s" }} className="footer-link-hover">
                {item.name}
              </Link>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em" }}>DESIGNED BY AMINE FJER • © 2026 MONCEF IA • ALL RIGHTS RESERVED</div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc, list, premium = false, delay }: { icon: React.ReactNode, title: string, desc: string, list: string[], premium?: boolean, delay: number }) {
  return (
    <TiltCard delay={delay} className="card card-gsap" style={{ padding: "48px 32px", position: "relative", overflow: "hidden" }}>
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

