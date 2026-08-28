"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, ArrowLeft, Eye, Lock, FileText, Globe } from "lucide-react";
import dynamic from "next/dynamic";

const LanguageSwitcher = dynamic(() => import("@/components/LanguageSwitcher"), { ssr: false });

const content = {
  fr: {
    title: "Politique de Confidentialité",
    subtitle: "Dernière mise à jour : Mai 2026",
    intro: "Chez Moncef IA, nous prenons la protection de vos données personnelles très au sérieux. Cette politique explique comment nous recueillons, utilisons et protégeons vos informations.",
    section1_title: "1. Collecte des Données",
    section1_desc: "Nous collectons uniquement les informations nécessaires au bon fonctionnement de la plateforme : nom, prénom, adresse e-mail, ainsi que les données relatives à vos cours et devoirs que vous choisissez d'importer.",
    section2_title: "2. Utilisation de l'IA et Traitement",
    section2_desc: "Vos cours et documents sont analysés localement ou via des API sécurisées de modèles de langage (LLM). Nous ne revendons pas vos données et ne les utilisons pas pour entraîner des modèles publics sans votre consentement.",
    section3_title: "3. Sécurité des Données",
    section3_desc: "Toutes les connexions sont chiffrées de bout en bout (SSL/TLS). Vos données personnelles et fichiers de cours sont stockés sur des serveurs sécurisés conformes aux normes RGPD.",
    section4_title: "4. Vos Droits",
    section4_desc: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles. Vous pouvez supprimer votre compte à tout moment depuis les paramètres de votre console.",
    back: "Retour à l'accueil"
  },
  en: {
    title: "Privacy Policy",
    subtitle: "Last Updated: May 2026",
    intro: "At Moncef IA, we take the protection of your personal data very seriously. This policy explains how we collect, use, and protect your information.",
    section1_title: "1. Data Collection",
    section1_desc: "We only collect information necessary for the proper functioning of the platform: first name, last name, email address, and data related to your courses and homework that you choose to import.",
    section2_title: "2. AI Usage and Processing",
    section2_desc: "Your courses and documents are analyzed locally or via secure Language Model (LLM) APIs. We do not sell your data or use it to train public models without your consent.",
    section3_title: "3. Data Security",
    section3_desc: "All connections are encrypted end-to-end (SSL/TLS). Your personal data and course files are stored on secure servers compliant with GDPR standards.",
    section4_title: "4. Your Rights",
    section4_desc: "In accordance with GDPR, you have the right to access, rectify, and delete your personal data. You can delete your account at any time from your console settings.",
    back: "Back to Home"
  },
  es: {
    title: "Política de Privacidad",
    subtitle: "Última actualización: Mayo de 2026",
    intro: "En Moncef IA, nos tomamos muy en serio la protección de sus datos personales. Esta política explica cómo recopilamos, utilizamos y protegemos su información.",
    section1_title: "1. Recopilación de Datos",
    section1_desc: "Solo recopilamos la información necesaria para el correcto funcionamiento de la plataforma: nombre, apellido, dirección de correo electrónico y datos relacionados con sus cursos y tareas que decida importar.",
    section2_title: "2. Uso de IA y Procesamiento",
    section2_desc: "Sus cursos y documentos se analizan localmente o mediante API seguras de Modelos de Lenguaje (LLM). No vendemos sus datos ni los usamos para entrenar modelos públicos sin su consentimiento.",
    section3_title: "3. Seguridad de los Datos",
    section3_desc: "Todas las conexiones están cifradas de extremo a extremo (SSL/TLS). Sus datos personales y archivos de cursos se almacenan en servidores seguros que cumplen con los estándares RGPD.",
    section4_title: "4. Sus Derechos",
    section4_desc: "De acuerdo con el RGPD, tiene derecho a acceder, rectificar y eliminar sus datos personales. Puede eliminar su cuenta en cualquier momento desde la configuración de su consola.",
    back: "Volver al inicio"
  },
  ar: {
    title: "سياسة الخصوصية",
    subtitle: "آخر تحديث: ماي 2026",
    intro: "في منصف IA، نأخذ حماية بياناتك الشخصية على محمل الجد. تشرح هذه السياسة كيفية جمع معلوماتك واستخدامها وحمايتها.",
    section1_title: "1. جمع البيانات",
    section1_desc: "نحن نجمع فقط المعلومات اللازمة للتشغيل السليم للمنصة: الاسم الأول، الاسم الأخير، عنوان البريد الإلكتروني، والبيانات المتعلقة بدروسك وواجباتك التي تختار استيرادها.",
    section2_title: "2. استخدام الذكاء الاصطناعي والمعالجة",
    section2_desc: "يتم تحليل دروسك ومستنداتك محلياً أو عبر واجهات برمجة تطبيقات آمنة لنماذج اللغة الكبيرة (LLM). نحن لا نبيع بياناتك ولا نستخدمها لتدريب النماذج العامة دون موافقتك.",
    section3_title: "3. أمن البيانات",
    section3_desc: "جميع الاتصالات مشفرة من البداية للنهاية (SSL/TLS). يتم تخزين بياناتك الشخصية وملفات دروسك على خوادم آمنة متوافقة مع معايير GDPR.",
    section4_title: "4. حقوقك",
    section4_desc: "وفقاً للائحة العامة لحماية البيانات (GDPR)، لديك الحق في الوصول إلى بياناتك الشخصية وتصحيحها وحذفها. يمكنك حذف حسابك في أي وقت من إعدادات لوحة التحكم الخاصة بك.",
    back: "العودة إلى الرئيسية"
  }
};

export default function PrivacyPage() {
  const [lang, setLang] = useState("fr");

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

  const t = content[lang as keyof typeof content] || content.fr;

  return (
    <div style={{ minHeight: "100vh", background: "#060a14", color: "#fff", position: "relative", overflowX: "hidden" }}>
      {/* Background decoration */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(89,130,255,0.1) 0%, transparent 70%)", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "40%", height: "40%", background: "radial-gradient(circle, rgba(0,210,182,0.08) 0%, transparent 70%)", filter: "blur(100px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto", padding: "40px 24px" }}>
        {/* Header toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: "14px", fontWeight: "600", transition: "color 0.2s" }} className="hover-white">
            <ArrowLeft size={16} />
            {t.back}
          </Link>
          <LanguageSwitcher currentLang={lang} onSwitch={switchLang} />
        </div>

        {/* Title Block */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ marginBottom: "48px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "rgba(89,130,255,0.1)", border: "1px solid rgba(89,130,255,0.2)", borderRadius: "99px", padding: "8px 18px", color: "var(--p)", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>
            <Shield size={14} /> Privacy Core
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: "800", fontFamily: "var(--font2)", letterSpacing: "-0.03em", marginBottom: "12px", lineHeight: "1.1" }}>
            {t.title}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", fontWeight: "600" }}>{t.subtitle}</p>
        </motion.div>

        {/* Main Content */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }} style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <p style={{ fontSize: "17px", lineHeight: "1.6", color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "20px", padding: "24px" }}>
            {t.intro}
          </p>

          <div style={{ display: "grid", gap: "24px" }}>
            {[
              { icon: Eye, title: t.section1_title, desc: t.section1_desc },
              { icon: Globe, title: t.section2_title, desc: t.section2_desc },
              { icon: Lock, title: t.section3_title, desc: t.section3_desc },
              { icon: FileText, title: t.section4_title, desc: t.section4_desc }
            ].map((section, idx) => (
              <div key={idx} className="glass-card" style={{ padding: "30px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "20px", alignItems: "flex-start", borderRadius: "20px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--a)", flexShrink: 0 }}>
                  <section.icon size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px", fontFamily: "var(--font2)" }}>{section.title}</h3>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", lineHeight: "1.6" }}>{section.desc}</p>
                </div>
              </div>
            ))}
          </div>
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
