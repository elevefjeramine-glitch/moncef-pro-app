"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Scale, ArrowLeft, CheckCircle, AlertOctagon, RefreshCw, UserCheck } from "lucide-react";
import dynamic from "next/dynamic";

const LanguageSwitcher = dynamic(() => import("@/components/LanguageSwitcher"), { ssr: false });

const content = {
  fr: {
    title: "Conditions Générales d'Utilisation",
    subtitle: "Dernière mise à jour : Mai 2026",
    intro: "En utilisant la plateforme Moncef IA, vous acceptez d'être lié par les présentes conditions générales d'utilisation. Veuillez les lire attentivement.",
    section1_title: "1. Acceptation des Conditions",
    section1_desc: "L'accès et l'utilisation de Moncef IA sont soumis à votre acceptation pleine et entière de ces conditions. Si vous n'êtes pas d'accord, vous ne devez pas utiliser le service.",
    section2_title: "2. Utilisation du Service et Crédits",
    section2_desc: "Le service fournit des outils d'IA et de productivité. Les comptes gratuits reçoivent un volume initial de crédits (jetons). L'utilisation abusive, les requêtes automatisées excessives (bots) ou le contournement des limites sont interdits.",
    section3_title: "3. Responsabilité de l'Utilisateur",
    section3_desc: "Vous êtes responsable de tout contenu (cours, documents, devoirs) importé dans la plateforme. Vous garantissez posséder les droits nécessaires pour traiter ces documents via nos services d'IA.",
    section4_title: "4. Propriété Intellectuelle et Modifications",
    section4_desc: "Tous les droits sur la plateforme, sa marque et son design appartiennent à Moncef IA. Nous nous réservons le droit de modifier ou de suspendre le service à tout moment.",
    back: "Retour à l'accueil"
  },
  en: {
    title: "Terms of Service",
    subtitle: "Last Updated: May 2026",
    intro: "By using the Moncef IA platform, you agree to be bound by these terms of service. Please read them carefully.",
    section1_title: "1. Acceptance of Terms",
    section1_desc: "Access and use of Moncef IA are subject to your full acceptance of these terms. If you do not agree, you must not use the service.",
    section2_title: "2. Service Usage & Credits",
    section2_desc: "The service provides AI and productivity tools. Free accounts receive an initial allocation of credits (tokens). Abuse, excessive automated queries (bots), or bypassing limits is strictly prohibited.",
    section3_title: "3. User Responsibility",
    section3_desc: "You are responsible for any content (courses, documents, homework) imported into the platform. You warrant that you hold the necessary rights to process these documents via our AI services.",
    section4_title: "4. Intellectual Property & Changes",
    section4_desc: "All rights to the platform, brand, and design belong to Moncef IA. We reserve the right to modify or suspend the service at any time.",
    back: "Back to Home"
  },
  es: {
    title: "Condiciones Generales de Uso",
    subtitle: "Última actualización: Mayo de 2026",
    intro: "Al utilizar la plataforma Moncef IA, acepta estar sujeto a estos términos de servicio. Por favor, léalos atentamente.",
    section1_title: "1. Aceptación de los Términos",
    section1_desc: "El acceso y uso de Moncef IA están sujetos a su aceptación total de estos términos. Si no está de acuerdo, no debe utilizar el servicio.",
    section2_title: "2. Uso del Servicio y Créditos",
    section2_desc: "El servicio proporciona herramientas de IA y productividad. Las cuentas gratuitas reciben una asignación inicial de créditos (tokens). Se prohíbe el abuso, las consultas automatizadas excesivas (bots) o la elusión de límites.",
    section3_title: "3. Responsabilidad del Usuario",
    section3_desc: "Usted es responsable de cualquier contenido (cursos, documentos, tareas) importado a la plataforma. Usted garantiza que posee los derechos necesarios para procesar estos documentos a través de nuestros servicios de IA.",
    section4_title: "4. Propiedad Intelectual y Modificaciones",
    section4_desc: "Todos los derechos sobre la plataforma, su marca y diseño pertenecen a Moncef IA. Nos reservamos el derecho de modificar o suspender el servicio en cualquier momento.",
    back: "Volver al inicio"
  },
  ar: {
    title: "شروط الخدمة",
    subtitle: "آخر تحديث: ماي 2026",
    intro: "باستخدام منصة ذكاء منصف، فإنك توافق على الالتزام بشروط الخدمة هذه. يرجى قراءتها بعناية.",
    section1_title: "1. قبول الشروط",
    section1_desc: "يخضع الوصول إلى منصة منصف IA واستخدامها لقبولك الكامل لهذه الشروط. إذا كنت لا توافق، فيجب عليك عدم استخدام الخدمة.",
    section2_title: "2. استخدام الخدمة والاهتمامات",
    section2_desc: "توفر الخدمة أدوات ذكاء اصطناعي وإنتاجية. تتلقى الحسابات المجانية تخصيصًا أوليًا من الرصيد (الرموز). يُمنع تمامًا إساءة الاستخدام، أو طلبات الاستعلام الآلية المفرطة (bots)، أو تجاوز الحدود المسموح بها.",
    section3_title: "3. مسؤولية المستخدم",
    section3_desc: "أنت مسؤول عن أي محتوى (دروس، مستندات، واجبات) يتم استيراده إلى المنصة. وتضمن أنك تمتلك الحقوق اللازمة لمعالجة هذه المستندات عبر خدمات الذكاء الاصطناعي الخاصة بنا.",
    section4_title: "4. الملكية الفكرية والتعديلات",
    section4_desc: "جميع الحقوق الخاصة بالمنصة وعلامتها التجارية وتصميمها تعود لمنصف IA. نحتفظ بالحق في تعديل الخدمة أو تعليقها في أي وقت.",
    back: "العودة إلى الرئيسية"
  }
};

export default function TermsPage() {
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
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "rgba(0,210,182,0.1)", border: "1px solid rgba(0,210,182,0.2)", borderRadius: "99px", padding: "8px 18px", color: "var(--a)", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>
            <Scale size={14} /> Legal Terms
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
              { icon: CheckCircle, title: t.section1_title, desc: t.section1_desc },
              { icon: RefreshCw, title: t.section2_title, desc: t.section2_desc },
              { icon: UserCheck, title: t.section3_title, desc: t.section3_desc },
              { icon: AlertOctagon, title: t.section4_title, desc: t.section4_desc }
            ].map((section, idx) => (
              <div key={idx} className="glass-card" style={{ padding: "30px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "20px", alignItems: "flex-start", borderRadius: "20px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyValue: "center", justifyContent: "center", color: "var(--p)", flexShrink: 0 }}>
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
