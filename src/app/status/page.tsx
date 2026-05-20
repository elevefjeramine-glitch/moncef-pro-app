"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, Cpu, Server, Database, MessageSquare } from "lucide-react";
import dynamic from "next/dynamic";

const LanguageSwitcher = dynamic(() => import("@/components/LanguageSwitcher"), { ssr: false });

const content = {
  fr: {
    title: "État des Services Moncef IA",
    subtitle: "Dernière mise à jour : Temps réel",
    overall_ok: "Tous les services sont opérationnels",
    uptime_30d: "Disponibilité (30j)",
    operational: "Opérationnel",
    incident: "Incident",
    back: "Retour à l'accueil",
    history: "Historique des pannes (90 jours)",
    no_incidents: "Aucun incident majeur signalé sur les 90 derniers jours."
  },
  en: {
    title: "Moncef IA Service Status",
    subtitle: "Last Updated: Real-time",
    overall_ok: "All Systems Operational",
    uptime_30d: "Uptime (30d)",
    operational: "Operational",
    back: "Back to Home",
    history: "Outage History (90 days)",
    no_incidents: "No major incidents reported in the last 90 days."
  },
  es: {
    title: "Estado del Servicio Moncef IA",
    subtitle: "Última actualización: Tiempo real",
    overall_ok: "Todos los sistemas operativos",
    uptime_30d: "Disponibilidad (30d)",
    operational: "Operativo",
    back: "Volver al inicio",
    history: "Historial de interrupciones (90 días)",
    no_incidents: "No se han reportado incidentes importantes en los últimos 90 días."
  },
  ar: {
    title: "حالة خدمات ذكاء منصف",
    subtitle: "آخر تحديث: في الوقت الفعلي",
    overall_ok: "جميع الأنظمة تعمل بشكل طبيعي",
    uptime_30d: "وقت التشغيل (30 يومًا)",
    operational: "يعمل بشكل طبيعي",
    back: "العودة إلى الرئيسية",
    history: "سجل الانقطاعات (90 يومًا)",
    no_incidents: "لم يتم الإبلاغ عن أي حوادث انقطاع رئيسية خلال الـ 90 يومًا الماضية."
  }
};

export default function StatusPage() {
  const [lang, setLang] = useState("fr");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("site_lang");
    if (saved && saved in content) {
      setLang(saved);
      document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";
    }
  }, []);

  const switchLang = (l: string) => {
    if (l in content) {
      setLang(l);
      localStorage.setItem("site_lang", l);
      document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const t = content[lang as keyof typeof content] || content.fr;

  const services = [
    { name: "AI Gateway & LLM Core", icon: Cpu, latency: "142ms", uptime: "99.85%", desc: "Routing core to language models", status: "ok" },
    { name: "Database Core (Supabase)", icon: Database, latency: "38ms", uptime: "100%", desc: "User profiles, schedules & homework", status: "ok" },
    { name: "Cortex Comm (Messaging)", icon: MessageSquare, latency: "52ms", uptime: "99.94%", desc: "Encrypted internal communications", status: "ok" },
    { name: "OCR & Document Parsing Engine", icon: Server, latency: "210ms", uptime: "99.70%", desc: "PDF & Image translation service", status: "ok" }
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#060a14", color: "#fff", position: "relative", overflowX: "hidden" }}>
      {/* Background decoration */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(0,210,182,0.1) 0%, transparent 70%)", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "40%", height: "40%", background: "radial-gradient(circle, rgba(89,130,255,0.08) 0%, transparent 70%)", filter: "blur(100px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto", padding: "40px 24px" }}>
        {/* Header toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: "14px", fontWeight: "600", transition: "color 0.2s" }} className="hover-white">
            <ArrowLeft size={16} />
            {t.back}
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button onClick={handleRefresh} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <motion.div animate={refreshing ? { rotate: -360 } : {}} transition={{ duration: 0.8, ease: "linear" }}>
                <RefreshCw size={16} />
              </motion.div>
            </button>
            <LanguageSwitcher currentLang={lang} onSwitch={switchLang} />
          </div>
        </div>

        {/* Status Hub Indicator */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: "rgba(0,230,138,0.04)", border: "1px solid rgba(0,230,138,0.2)", borderRadius: "24px", padding: "32px", display: "flex", alignItems: "center", gap: "24px", marginBottom: "40px" }}>
          <div style={{ position: "relative", display: "flex" }}>
            <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", inset: -8, background: "var(--ok)", borderRadius: "50%", opacity: 0.3 }} />
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--ok)", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", zIndex: 1 }}>
              <CheckCircle2 size={22} />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", fontFamily: "var(--font2)", marginBottom: "4px" }}>{t.overall_ok}</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>{t.subtitle}</p>
          </div>
        </motion.div>

        {/* Services List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "48px" }}>
          {services.map((srv, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-card" style={{ padding: "24px 30px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "20px", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--a)" }}>
                  <srv.icon size={18} />
                </div>
                <div>
                  <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "2px", fontFamily: "var(--font2)" }}>{srv.name}</h4>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>{srv.desc}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>{srv.latency}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Latency</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>{srv.uptime}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Uptime</div>
                </div>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--ok)", background: "rgba(0,230,138,0.1)", border: "1px solid rgba(0,230,138,0.2)", borderRadius: "99px", padding: "4px 12px" }}>
                  {t.operational}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Outage History */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="glass-card" style={{ padding: "30px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <Activity size={18} style={{ color: "var(--p)" }} />
            <h3 style={{ fontSize: "18px", fontWeight: "800", fontFamily: "var(--font2)" }}>{t.history}</h3>
          </div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", lineHeight: "1.6" }}>{t.no_incidents}</p>
        </motion.div>
      </div>

      <style jsx>{`
        .hover-white:hover {
          color: #fff !important;
        }
      `}</style>
    </div>
  );
}
