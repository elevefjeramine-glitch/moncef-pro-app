"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Terminal, ArrowLeft, Code2, Database, Key, Send, Copy, Check } from "lucide-react";
import dynamic from "next/dynamic";

const LanguageSwitcher = dynamic(() => import("@/components/LanguageSwitcher"), { ssr: false });

const content = {
  fr: {
    title: "Documentation API développeur",
    subtitle: "Dernière mise à jour : Mai 2026",
    intro: "Intégrez la puissance de Moncef IA dans vos propres outils d'apprentissage. Notre API REST simple vous permet d'interagir avec les modèles LLM configurés de notre plateforme.",
    endpoint_title: "Points de terminaison (Endpoints)",
    auth_title: "1. Authentification",
    auth_desc: "Toutes les requêtes d'API doivent inclure votre clé d'authentification Bearer JWT Supabase dans les en-têtes HTTP.",
    chat_title: "2. Envoyer un message (POST /api/chat)",
    chat_desc: "Interagissez directement avec Moncef IA et recevez des réponses contextuelles.",
    payload: "Structure de la requête",
    response: "Réponse attendue (JSON)",
    back: "Retour à l'accueil",
    copied: "Copié !"
  },
  en: {
    title: "Developer API Documentation",
    subtitle: "Last Updated: May 2026",
    intro: "Integrate the power of Moncef IA into your own learning tools. Our simple REST API allows you to interact with the LLM models configured on our platform.",
    endpoint_title: "Endpoints",
    auth_title: "1. Authentication",
    auth_desc: "All API requests must include your Bearer JWT Supabase auth key in HTTP headers.",
    chat_title: "2. Send Message (POST /api/chat)",
    chat_desc: "Interact directly with Moncef IA and receive context-aware responses.",
    payload: "Request payload",
    response: "Expected Response (JSON)",
    back: "Back to Home",
    copied: "Copied!"
  },
  es: {
    title: "Documentación de la API",
    subtitle: "Última actualización: Mayo de 2026",
    intro: "Integre el poder de Moncef IA en sus propias herramientas de aprendizaje. Nuestra sencilla API REST le permite interactuar con los modelos LLM configurados en nuestra plataforma.",
    endpoint_title: "Puntos de enlace (Endpoints)",
    auth_title: "1. Autenticación",
    auth_desc: "Todas las solicitudes de API deben incluir su clave de autenticación Bearer JWT Supabase en los encabezados HTTP.",
    chat_title: "2. Enviar mensaje (POST /api/chat)",
    chat_desc: "Interactúe directamente con Moncef IA y reciba respuestas contextuales.",
    payload: "Estructura de la solicitud",
    response: "Respuesta esperada (JSON)",
    back: "Volver al inicio",
    copied: "¡Copiado!"
  },
  ar: {
    title: "وثائق واجهة برمجة التطبيقات (API)",
    subtitle: "آخر تحديث: ماي 2026",
    intro: "ادمج قوة ذكاء منصف في أدوات التعلم الخاصة بك. تتيح لك واجهة برمجة تطبيقات REST البسيطة التفاعل مع نماذج الـ LLM المهيأة على منصتنا.",
    endpoint_title: "نقاط النهاية (Endpoints)",
    auth_title: "1. المصادقة",
    auth_desc: "يجب أن تتضمن جميع طلبات واجهة برمجة التطبيقات مفتاح مصادقة Bearer JWT Supabase في ترويسات HTTP.",
    chat_title: "2. إرسال رسالة (POST /api/chat)",
    chat_desc: "تفاعل مباشرة مع ذكاء منصف واستقبل استجابات ذكية متوافقة مع السياق.",
    payload: "هيكل الطلب",
    response: "الاستجابة المتوقعة (JSON)",
    back: "العودة إلى الرئيسية",
    copied: "تم النسخ!"
  }
};

export default function ApiDocsPage() {
  const [lang, setLang] = useState("fr");
  const [copyState, setCopyState] = useState("");

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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyState(id);
    setTimeout(() => setCopyState(""), 2000);
  };

  const t = content[lang as keyof typeof content] || content.fr;

  const curlExample = `curl -X POST https://proappmoncef.netlify.app/api/chat \\
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "Explique-moi la relativité restreinte simplement."}
    ],
    "model": "gpt-4o"
  }'`;

  const jsonResponse = `{
  "id": "chatcmpl-98aBcD...",
  "object": "chat.completion",
  "created": 1715629201,
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "La relativité restreinte, théorisée par Einstein, repose sur deux principes..."
      },
      "finish_reason": "stop"
    }
  ]
}`;

  return (
    <div style={{ minHeight: "100vh", background: "#060a14", color: "#fff", position: "relative", overflowX: "hidden" }}>
      {/* Background decoration */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(89,130,255,0.1) 0%, transparent 70%)", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "40%", height: "40%", background: "radial-gradient(circle, rgba(0,210,182,0.08) 0%, transparent 70%)", filter: "blur(100px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", padding: "40px 24px" }}>
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
            <Terminal size={14} /> Dev API
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: "800", fontFamily: "var(--font2)", letterSpacing: "-0.03em", marginBottom: "12px", lineHeight: "1.1" }}>
            {t.title}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", fontWeight: "600" }}>{t.subtitle}</p>
        </motion.div>

        {/* Intro */}
        <p style={{ fontSize: "17px", lineHeight: "1.6", color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "20px", padding: "24px", marginBottom: "40px" }}>
          {t.intro}
        </p>

        {/* API Docs Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          
          {/* 1. Auth */}
          <div className="glass-card" style={{ padding: "30px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <Key size={20} style={{ color: "var(--a)" }} />
              <h3 style={{ fontSize: "20px", fontWeight: "800", fontFamily: "var(--font2)" }}>{t.auth_title}</h3>
            </div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>{t.auth_desc}</p>
            <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px 20px", borderRadius: "12px", fontFamily: "Courier New, monospace", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Authorization: Bearer &lt;YOUR_SUPABASE_JWT&gt;
            </div>
          </div>

          {/* 2. Chat Endpoint */}
          <div className="glass-card" style={{ padding: "30px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <Send size={20} style={{ color: "var(--p)" }} />
              <h3 style={{ fontSize: "20px", fontWeight: "800", fontFamily: "var(--font2)" }}>{t.chat_title}</h3>
            </div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>{t.chat_desc}</p>

            {/* CURL Terminal Card */}
            <div style={{ position: "relative", marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.05)", borderTopLeftRadius: "14px", borderTopRightRadius: "14px", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>cURL Request</span>
                <button onClick={() => handleCopy(curlExample, "curl")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                  {copyState === "curl" ? <><Check size={14} style={{ color: "var(--ok)" }} /> {t.copied}</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
              <pre style={{ margin: 0, padding: "20px", background: "#0a0f1d", borderBottomLeftRadius: "14px", borderBottomRightRadius: "14px", overflowX: "auto", fontFamily: "Courier New, monospace", fontSize: "13px", color: "#a6accd", border: "1px solid rgba(255,255,255,0.08)", borderTop: "none" }}>
                <code>{curlExample}</code>
              </pre>
            </div>

            {/* JSON Response Terminal Card */}
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.05)", borderTopLeftRadius: "14px", borderTopRightRadius: "14px", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>JSON Response</span>
                <button onClick={() => handleCopy(jsonResponse, "json")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                  {copyState === "json" ? <><Check size={14} style={{ color: "var(--ok)" }} /> {t.copied}</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
              <pre style={{ margin: 0, padding: "20px", background: "#0a0f1d", borderBottomLeftRadius: "14px", borderBottomRightRadius: "14px", overflowX: "auto", fontFamily: "Courier New, monospace", fontSize: "13px", color: "#a6accd", border: "1px solid rgba(255,255,255,0.08)", borderTop: "none" }}>
                <code>{jsonResponse}</code>
              </pre>
            </div>

          </div>
        </div>
      </div>

      <style jsx>{`
        .hover-white:hover {
          color: #fff !important;
        }
      `}</style>
    </div>
  );
}
