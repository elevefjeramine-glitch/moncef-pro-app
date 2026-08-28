"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, ArrowLeft, Database, Key, Sparkles, AlertTriangle, CircleDot } from "lucide-react";
import dynamic from "next/dynamic";

const LanguageSwitcher = dynamic(() => import("@/components/LanguageSwitcher"), { ssr: false });

// Page volontairement dépourvue de chiffre décoratif. Avant la réécriture du
// 2026-08-28, ce fichier affichait des latences (« 142 ms », « 38 ms »), des
// disponibilités (« 99,85 % ») et un historique de 90 jours : rien de tout
// cela n'était mesuré, c'était du texte. Tout ce qui suit vient soit de
// /api/health (mesures côté serveur), soit du navigateur du visiteur
// (performance.now et Timing Navigation). Aucun échantillon n'est conservé :
// il n'existe pas de sonde historique, donc aucun pourcentage de disponibilité
// n'est calculable, et la page le dit au lieu de l'inventer.

type Check = { key: string; label: string; ok: boolean; latencyMs: number | null; detail: string };
type Health = {
  status: string;
  observedAt: string;
  durationMs: number;
  checks: Check[];
  deployment?: { commit: string | null; branch: string | null; buildId: string | null; context: string | null };
};

const SAMPLE_TARGET = 6;
const REFRESH_MS = 20000;

const content = {
  fr: {
    title: "État du service",
    subtitle: "Mesures en direct, prises maintenant. Rien sur cette page n'est historique ni prévisionnel.",
    live: "en direct",
    every: "Nouvelle mesure toutes les 20 s, pendant que tu lis cette page.",
    overall_ok: "Tout répond",
    overall_degraded: "Dégradation en cours",
    overall_pending: "Première mesure en cours…",
    global_latency: "Aller-retour depuis ton navigateur",
    global_latency_hint: "min — médiane — max sur tes {n} mesures de cette visite",
    doc_ttfb: "Réponse de cette page (ton navigateur)",
    doc_ttfb_hint: "temps jusqu'au dernier octet du HTML, via le CDN",
    checks_title: "Ce que le serveur a sondé",
    history_title: "Cette visite",
    history_hint: "{n} échantillons, {ms} ms d'écart entre le plus rapide et le plus lent. Usés {date}.",
    samples: "échantillons",
    notmeasured_title: "Ce que cette page ne mesure pas",
    notmeasured: [
      "Aucun pourcentage de disponibilité : aucune sonde n'enregistre l'historique, sur 90 jours comme sur 5 minutes. Écrire « 99,9 % » serait un chiffre inventé.",
      "Aucun temps de réponse du modèle d'IA : le vérifier coûterait 10 crédits et 2 secondes pour un chiffre qui ne veut rien dire hors usage. La sonde indique seulement si la configuration existe.",
      "Aucune bascule automatique ni région de secours : le site est servi par Netlify, les données sont en un seul endroit (voir la politique de confidentialité).",
      "Aucune alerte : personne n'est prévenu si une case passe en rouge. En cas de doute, l'URL JSON ci-dessous est à ta disposition.",
    ],
    json: "URL de la sonde (JSON brut)",
    docs: "Documentation API",
    back: "Retour à l'accueil",
    status_ok: "opérationnel",
    status_bad: "en défaut",
    status_na: "non mesuré",
    last_observed: "Relevé serveur à",
  },
  en: {
    title: "Service status",
    subtitle: "Live measurements, taken right now. Nothing on this page is historical or forecast.",
    live: "live",
    every: "A new measurement every 20 s, while you read this page.",
    overall_ok: "Everything answers",
    overall_degraded: "Degraded right now",
    overall_pending: "First measurement…",
    global_latency: "Round trip from your browser",
    global_latency_hint: "min — median — max over your {n} samples from this visit",
    doc_ttfb: "This page's response (your browser)",
    doc_ttfb_hint: "time to last byte of the HTML, through the CDN",
    checks_title: "What the server probed",
    history_title: "This visit",
    history_hint: "{n} samples, {ms} ms between fastest and slowest. Taken {date}.",
    samples: "samples",
    notmeasured_title: "What this page does not measure",
    notmeasured: [
      "No uptime percentage: no probe stores history, not over 90 days nor over 5 minutes. Printing “99.9%” would be an invented number.",
      "No AI model response time: checking it would cost 10 credits and 2 seconds for a figure that means nothing outside real usage. The probe only reports whether the configuration exists.",
      "No automatic failover or backup region: the site is served by Netlify, the data sits in one place (see the privacy policy).",
      "No alerting: nobody is notified if a box turns red. When in doubt, the JSON URL below is yours to call.",
    ],
    json: "Probe URL (raw JSON)",
    docs: "API documentation",
    back: "Back to home",
    status_ok: "operational",
    status_bad: "failing",
    status_na: "not measured",
    last_observed: "Server measured at",
  },
  es: {
    title: "Estado del servicio",
    subtitle: "Mediciones en vivo, tomadas ahora. Nada de esta página es histórico ni previsión.",
    live: "en vivo",
    every: "Una medición nueva cada 20 s, mientras lees esta página.",
    overall_ok: "Todo responde",
    overall_degraded: "Degradación en curso",
    overall_pending: "Primera medición…",
    global_latency: "Ida y vuelta desde tu navegador",
    global_latency_hint: "mín — mediana — máx sobre tus {n} mediciones de esta visita",
    doc_ttfb: "Respuesta de esta página (tu navegador)",
    doc_ttfb_hint: "tiempo hasta el último byte del HTML, vía CDN",
    checks_title: "Lo que sondeó el servidor",
    history_title: "Esta visita",
    history_hint: "{n} muestras, {ms} ms entre la más rápida y la más lenta. Tomadas el {date}.",
    samples: "muestras",
    notmeasured_title: "Lo que esta página no mide",
    notmeasured: [
      "Ningún porcentaje de disponibilidad: ninguna sonda guarda el historial, ni a 90 días ni a 5 minutos. Escribir «99,9 %» sería un número inventado.",
      "Ningún tiempo de respuesta del modelo de IA: medirlo costaría 10 créditos y 2 segundos por una cifra que no dice nada fuera del uso real. La sonda solo indica si la configuración existe.",
      "Ninguna conmutación automática ni región de respaldo: el sitio lo sirve Netlify, los datos están en un solo lugar (ver la política de privacidad).",
      "Ninguna alerta: nadie se entera si una casilla se pone en rojo. Ante la duda, la URL JSON de abajo está disponible.",
    ],
    json: "URL de la sonda (JSON crudo)",
    docs: "Documentación de la API",
    back: "Volver al inicio",
    status_ok: "operativo",
    status_bad: "en fallo",
    status_na: "no medido",
    last_observed: "Medido por el servidor a las",
  },
  ar: {
    title: "حالة الخدمة",
    subtitle: "قياسات حيّة، مأخوذة الآن. لا شيء في هذه الصفحة تاريخي ولا توقّعي.",
    live: "مباشر",
    every: "قياس جديد كل 20 ثانية، طالما أنك تقرأ هذه الصفحة.",
    overall_ok: "كل شيء يستجيب",
    overall_degraded: "تدهور جارٍ",
    overall_pending: "القياس الأول…",
    global_latency: "ذهابًا وإيابًا من متصفحك",
    global_latency_hint: "أدنى — وسيط — أعلى من بين {n} قياسات في هذه الزيارة",
    doc_ttfb: "زمن استجابة هذه الصفحة (متصفحك)",
    doc_ttfb_hint: "الوقت حتى آخر بايت من HTML مرورًا بشبكة التوزيع",
    checks_title: "ما فحصه الخادم",
    history_title: "هذه الزيارة",
    history_hint: "{n} عيّنة، و{ms} مللي ثانية بين الأسرع والأبطأ. القياس يوم {date}.",
    samples: "عيّنة",
    notmeasured_title: "ما لا تقيسه هذه الصفحة",
    notmeasured: [
      "لا نسبة توفر: لا مسبار يخزّن التاريخ، لا على 90 يومًا ولا على 5 دقائق. كتابة «99,9 ٪» ستكون رقمًا مختلَقًا.",
      "لا زمن استجابة لنموذج الذكاء: قياسه كان سيكلّف 10 رصيد وثانيتي انتظار مقابل رقم لا معنى له خارج الاستعمال الفعلي. المسبار يذكر فقط ما إذا كانت الإعدادات موجودة.",
      "لا تحويل تلقائي ولا منطقة بديلة: الموقع يُقدَّم عبر Netlify والبيانات في مكان واحد (انظر سياسة الخصوصية).",
      "لا تنبيهات: أحد لا يُبلَّغ إذا تحوّل مربع إلى الأحمر. عند الشك، رابط JSON أدناه رهن إشارتك.",
    ],
    json: "رابط المسبار (JSON خام)",
    docs: "وثيقة واجهة البرمجة",
    back: "العودة إلى الصفحة الأولى",
    status_ok: "يعمل",
    status_bad: "معطوب",
    status_na: "غير مقاس",
    last_observed: "قياس الخادم في",
  },
  zh: {
    title: "服务状态",
    subtitle: "实时测量，取自当前时刻。本页没有任何历史或预测数据。",
    live: "实时",
    every: "你阅读本页期间，每 20 秒重新测量一次。",
    overall_ok: "一切正常响应",
    overall_degraded: "当前存在降级",
    overall_pending: "首次测量中……",
    global_latency: "从你的浏览器算起的往返时间",
    global_latency_hint: "本次访问 {n} 次测量的 最小 — 中位 — 最大",
    doc_ttfb: "本页面的响应时间（你的浏览器）",
    doc_ttfb_hint: "从发出请求到收到 HTML 最后一字节的时间，经由 CDN",
    checks_title: "服务器探测到的结果",
    history_title: "本次访问",
    history_hint: "{n} 个样本，最快与最慢相差 {ms} 毫秒。采集于 {date}。",
    samples: "样本",
    notmeasured_title: "本页面不测量的内容",
    notmeasured: [
      "不提供可用率百分比：没有任何探测器保存历史数据，无论 90 天还是 5 分钟。写上“99.9%”就是编造数字。",
      "不测试 AI 模型的响应时间：验证一次要消耗 10 个额度、约两秒，而这个数字在实际使用之外没有意义。探测器只报告配置是否存在。",
      "没有自动故障切换，也没有备用区域：站点由 Netlify 提供服务，数据存放在单一地点（见隐私政策）。",
      "没有告警：某一项变红时不会通知任何人。若有疑问，下面的 JSON 地址可自行调用。",
    ],
    json: "探测地址（原始 JSON）",
    docs: "API 文档",
    back: "返回首页",
    status_ok: "正常",
    status_bad: "故障",
    status_na: "未测量",
    last_observed: "服务器测量时间",
  },
};

function stats(xs: number[]) {
  if (!xs.length) return { min: 0, med: 0, max: 0, n: 0 };
  const s = [...xs].sort((a, b) => a - b);
  return { min: s[0] ?? 0, med: s[Math.floor(s.length / 2)] ?? 0, max: s[s.length - 1] ?? 0, n: s.length };
}

export default function StatusPage() {
  const [lang, setLang] = useState("fr");
  const [health, setHealth] = useState<Health | null>(null);
  const [samples, setSamples] = useState<number[]>([]);
  const [docMs, setDocMs] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("site_lang");
    if (saved && saved in content) {
      setLang(saved);
      document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";
    }
    // Le temps de réponse du document, mesuré par le navigateur lui-même.
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) setDocMs(Math.round(nav.responseEnd));
  }, []);

  const switchLang = (l: string) => {
    if (l in content) {
      setLang(l);
      localStorage.setItem("site_lang", l);
      document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    }
  };

  const measure = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const started = performance.now();
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const ms = Math.round(performance.now() - started);
      const json = (await res.json()) as Health;
      setHealth(json);
      setSamples((prev) => [...prev, ms].slice(-SAMPLE_TARGET));
      setFailed(null);
    } catch (e: any) {
      // Un échec réseau est une information, pas un blanc : on l'affiche.
      setFailed(e?.message ? String(e.message) : "requête impossible");
      setSamples((prev) => [...prev, Math.round(performance.now() - started)].slice(-SAMPLE_TARGET));
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    measure();
    const id = setInterval(measure, REFRESH_MS);
    return () => clearInterval(id);
  }, [measure]);

  const t = content[lang as keyof typeof content] || content.fr;
  const st = stats(samples);
  const worst = samples.length ? Math.max(...samples) : 1;
  const bad = Boolean(failed) || (health ? health.checks.some((c) => !c.ok) : false);

  const fmt = (x: number) => `${x} ms`;
  const fill = (s: string, vals: Record<string, string | number>) =>
    s.replace(/\{(\w+)\}/g, (_, k) => String(vals[k] ?? ""));

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen" style={{ background: "radial-gradient(circle at 90% 0%, rgba(0,210,182,0.1), transparent 40%), #050810", color: "#fff", minHeight: "100vh", padding: "24px clamp(16px, 5vw, 56px) 80px" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "14px" }}>
            <ArrowLeft size={16} /> {t.back}
          </Link>
          <LanguageSwitcher currentLang={lang} onSwitch={switchLang} />
        </div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
            <Activity size={26} color="var(--a)" />
            <h1 style={{ fontSize: "clamp(26px,5vw,38px)", margin: 0, fontWeight: 900 }}>{t.title}</h1>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" as const, color: "var(--a)", background: "rgba(0,210,182,0.1)", padding: "4px 10px", borderRadius: "999px" }}>
              <CircleDot size={11} /> {t.live}
            </span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.7, margin: "0 0 6px", maxWidth: "70ch" }}>{t.subtitle}</p>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "12.5px", margin: "0 0 30px" }}>{t.every}</p>
        </motion.div>

        {/* Bandeau global */}
        <div style={{ background: bad ? "rgba(255,51,102,0.07)" : "rgba(46,213,115,0.06)", border: `1px solid ${bad ? "rgba(255,51,102,0.35)" : "rgba(46,213,115,0.3)"}`, borderRadius: "20px", padding: "22px", marginBottom: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>
              {health ? fill(t.last_observed, { date: new Date(health.observedAt).toLocaleTimeString(lang === "ar" ? "fr" : lang) }) : ""}
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: health ? (bad ? "#ff6b81" : "#2ed573") : "rgba(255,255,255,0.5)" }}>
              {!health ? t.overall_pending : bad ? t.overall_degraded : t.overall_ok}
            </div>
            {failed ? <div style={{ fontSize: "12.5px", color: "#ff6b81", marginTop: "6px" }}>{failed}</div> : null}
          </div>
          {health?.deployment?.commit ? (
            <div style={{ textAlign: lang === "ar" ? "left" : "right", fontSize: "12px", color: "rgba(255,255,255,0.45)", fontFamily: "ui-monospace, monospace" }}>
              {`commit ${health.deployment.commit}`}
              {health.deployment.branch ? ` · ${health.deployment.branch}` : ""}
              {health.deployment.context ? ` · ${health.deployment.context}` : ""}
            </div>
          ) : null}
        </div>

        {/* Latence navigateur */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "18px", marginBottom: "18px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "22px" }}>
            <h2 style={{ fontSize: "13px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.45)", margin: "0 0 12px" }}>{t.global_latency}</h2>
            <div style={{ fontSize: "30px", fontWeight: 900, color: "var(--a)", lineHeight: 1.1 }}>
              {st.n ? fmt(st.med) : "…"}
            </div>
            <div style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", marginTop: "8px" }}>
              {st.n ? `${fmt(st.min)} — ${fmt(st.med)} — ${fmt(st.max)}` : ""}
            </div>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", margin: "6px 0 0" }}>{fill(t.global_latency_hint, { n: st.n })}</p>

            {/* Les échantillons de CETTE visite, rien d'autre. */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "54px", marginTop: "18px" }}>
              {samples.map((s, i) => (
                <div key={i} title={fmt(s)} style={{ flex: 1, height: `${Math.max(12, Math.round((s / worst) * 100))}%`, background: s > 1500 ? "rgba(255,165,2,0.8)" : "rgba(0,210,182,0.55)", borderRadius: "4px 4px 0 0" }} />
              ))}
              {!samples.length ? <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>{t.samples}…</div> : null}
            </div>
            {samples.length > 1 ? (
              <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.3)", margin: "10px 0 0" }}>
                {fill(t.history_hint, { n: samples.length, ms: st.max - st.min, date: new Date().toLocaleDateString(lang === "ar" ? "fr" : lang) })}
              </p>
            ) : null}
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "22px" }}>
            <h2 style={{ fontSize: "13px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.45)", margin: "0 0 12px" }}>{t.doc_ttfb}</h2>
            <div style={{ fontSize: "30px", fontWeight: 900, color: "#a5f3fc", lineHeight: 1.1 }}>{docMs !== null ? fmt(docMs) : "…"}</div>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", margin: "8px 0 0" }}>{t.doc_ttfb_hint}</p>
          </div>
        </div>

        {/* Sonde serveur */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "22px", marginBottom: "18px" }}>
          <h2 style={{ fontSize: "15px", margin: "0 0 14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Database size={16} color="var(--a)" /> {t.checks_title}
          </h2>
          <div style={{ display: "grid", gap: "10px" }}>
            {(health?.checks ?? []).map((c) => {
              const Icon = c.key === "auth" ? Key : c.key === "ai" ? Sparkles : Database;
              return (
                <div key={c.key} style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(0,0,0,0.25)", borderRadius: "12px", padding: "12px 16px", flexWrap: "wrap" }}>
                  <Icon size={16} color={c.ok ? "#2ed573" : "#ff6b81"} />
                  <span style={{ fontSize: "13.5px", fontWeight: 700, flex: 1, minWidth: "150px" }}>{c.label}</span>
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontFamily: "ui-monospace, monospace" }}>{c.detail}</span>
                  <span style={{ fontSize: "11px", fontWeight: 900, textTransform: "uppercase" as const, color: c.latencyMs === null ? "rgba(255,255,255,0.35)" : c.ok ? "#2ed573" : "#ff6b81", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "999px" }}>
                    {c.latencyMs === null ? t.status_na : `${c.latencyMs} ms · ${c.ok ? t.status_ok : t.status_bad}`}
                  </span>
                </div>
              );
            })}
            {!health ? <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>{t.overall_pending}</div> : null}
          </div>
        </div>

        {/* Non mesuré */}
        <div style={{ background: "rgba(255,165,2,0.05)", border: "1px solid rgba(255,165,2,0.25)", borderRadius: "20px", padding: "22px", marginBottom: "26px" }}>
          <h2 style={{ fontSize: "15px", margin: "0 0 12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={16} color="#ffa502" /> {t.notmeasured_title}
          </h2>
          <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "10px", fontSize: "13px", color: "rgba(255,255,255,0.62)", lineHeight: 1.7 }}>
            {t.notmeasured.map((x) => <li key={x.slice(0, 24)}>{x}</li>)}
          </ul>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <code style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.3)", padding: "8px 12px", borderRadius: "10px" }}>
            {t.json} : /api/health
          </code>
          <Link href="/api/health" style={{ fontSize: "12.5px", color: "var(--a)", fontWeight: 700 }}>{"/api/health →"}</Link>
          <Link href="/api-docs" style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.6)" }}>{t.docs}</Link>
        </div>
      </div>
    </div>
  );
}
