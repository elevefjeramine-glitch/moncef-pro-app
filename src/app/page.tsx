"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { Bot, CalendarDays, ClipboardList, MessageSquare, ShieldCheck, Star, ArrowRight, Zap, Lock, Globe, Check, X, Crown, Shield, Database } from "lucide-react";
import { t } from "@/utils/i18n";
import { Suspense, useEffect, useState, useRef } from "react";
import { useUserStore } from "@/store/useUserStore";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { hasOAuthError, authUrlWithError } from "@/utils/oauth-errors";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import TiltCard from "@/components/TiltCard";

// TiltCard n''utilise ni window ni IntersectionObserver (relu dans src/components/TiltCard.tsx) :
// il peut donc être rendu au serveur. Avant ça, la grille de fonctionnalités n''existait que des
// Skeleton en HTML (6 « w-[320px] h-[300px] » mesurés dans le HTML de service) — si le chunk JS
// ne s''exécute pas, le visiteur reste devant une zone vide. Composant importé statiquement :

const InitialLangSelector = dynamic(() => import("@/components/InitialLangSelector"), { ssr: false, loading: () => <span className="landing-lang-slot" aria-hidden /> });
const LanguageSwitcher = dynamic(() => import("@/components/LanguageSwitcher"), { ssr: false, loading: () => <span className="landing-lang-slot" aria-hidden /> });

/* ─── Variants Framer Motion ─── */
// Les deux sections basses de la vitrine (rôles, pile technique) et le pied de page étaient écrits en dur en français, alors que la grille de fonctionnalités, elle, était déjà déclinée en cinq langues. Même régime que les pages publiques : dictionnaire local, repli sur le français si la langue manque.
//
// Trois affirmations retirées au passage, parce qu'elles ne tenaient pas devant le code :
//  - « messagerie cryptée » : les messages partent en HTTPS, pas chiffrés de bout en bout ;
//  - « confidentialité absolue des données utilisateur » : la RLS cloisonne par compte, l'opérateur du service peut quand même lire ;
//  - « Crédits rechargés périodiquement » : remplacé par le chiffre que le code applique (700 au premier appel d'une journée UTC, jamais de baisse).
type VitrineTexte = { title: string; desc: string };
type VitrineRole = VitrineTexte & { badge: string };
// Tuples et non tableaux : le projet compile avec noUncheckedIndexedAccess, donc
// `roles[0]` sur un tableau serait « possibly undefined ». Or ces trois rôles et ces
// quatre blocs sont exactement ce que la page affiche — s'il en manque un, le build
// doit échouer plutôt que rendre un `undefined` à l'écran.
const VITRINE: Record<'fr' | 'en' | 'es' | 'ar' | 'zh', {
  roles_title: string;
  stack_title: string;
  tiers_kicker: string;
  tiers_title: string;
  tiers_lede: string;
  note_grades: string;
  note_infra: string;
  roles: [VitrineRole, VitrineRole, VitrineRole];
  stack: [VitrineTexte, VitrineTexte, VitrineTexte, VitrineTexte];
  tagline: string;
  links: [string, string, string, string];
}> = {
  fr: {
    "roles_title": "Grades & Privilèges",
    "stack_title": "Technologies & Outils",
    "roles": [
      {
        "title": "Utilisateur Normal",
        "badge": "700 cr.",
        "desc": "Accès à l'IA pédagogique, gestion de l'emploi du temps individuel (Semaines A/B), messagerie interne et suivi des devoirs. Le solde remonte à 700 crédits au premier appel de chaque journée UTC ; il n'est jamais réduit quand il est plus haut."
      },
      {
        "title": "Modérateur",
        "badge": "Illimité",
        "desc": "Accès à la console d'administration ALPHA. Privilèges de modération : modification des profils utilisateurs (sauf Fondateur) et suppression des devoirs/contenus abusifs pour maintenir l'intégrité de la communauté."
      },
      {
        "title": "Fondateur Alpha",
        "badge": "Propriétaire",
        "desc": "Contrôle absolu sur l'écosystème. Privilèges d'administration globaux, consultation des statistiques de base de données en temps réel, réinitialisation de tokens et édition de rôles (promotions de modérateurs)."
      }
    ],
    "stack": [
      {
        "title": "Supabase (PostgreSQL & Realtime)",
        "desc": "Base de données PostgreSQL protégée par des politiques de niveau de ligne (RLS) : chaque compte ne lit que ses propres lignes. Pas de chiffrement de bout en bout pour autant — le contenu reste lisible par l'opérateur du service, comme l'écrit la politique de confidentialité. Abonnements WebSocket Postgres pour synchroniser calendriers et messages en temps réel."
      },
      {
        "title": "Netlify — hébergement et CDN",
        "desc": "Le site est servi et distribué par Netlify (en-tête `server: Netlify`, mesuré le 28 août 2026), avec HTTPS/TLS sur chaque route et les variables d'environnement conservées côté serveur. Aucune couche Cloudflare n'est en place sur ce domaine : la protection anti-DDoS et le WAF sont ceux de Netlify, pas les nôtres."
      },
      {
        "title": "Deux fournisseurs, un secours",
        "desc": "Le serveur appelle `gemini-3.6-flash` (Google AI) et bascule sur `openai/gpt-oss-20b` via Groq si le premier ne répond pas. Aucun autre modèle n'est branché : Claude 3.5 Sonnet, Gemini 2.5 Flash et Llama 3.3, cités ici auparavant, n'ont jamais été appelés par le code."
      },
      {
        "title": "Next.js (App Router) & Framer Motion",
        "desc": "Architecture moderne avec rendu hybride pour des performances maximales. Animations fluides et transitions d'état animées par Framer Motion à 60 images par seconde pour une expérience utilisateur premium."
      }
    ],
    "tiers_kicker": "Écosystème & Grades",
    "tiers_title": "Niveaux de grade & infrastructure",
    "tiers_lede": "Deux colonnes, une règle : ce qui est écrit ici correspond à du code qui tourne. Ni promesse, ni chiffre décoratif.",
    "note_grades": "Le plancher de 700 crédits s'applique au premier appel de chaque journée UTC ; un modérateur peut recharger avant, jamais l'inverse.",
    "note_infra": "Mesures du 28 août 2026 : en-tête server: Netlify, latences de la sonde /api/health, réponses relues sur les routes d'import.",
    "tagline": "Propulsé par les dernières avancées en Intelligence Artificielle pour une éducation sans frontière.",
    "links": [
      "Confidentialité",
      "Termes",
      "API",
      "Status"
    ]
  },
  en: {
    "roles_title": "Grades & Privileges",
    "stack_title": "Technologies & Tools",
    "roles": [
      {
        "title": "Standard User",
        "badge": "700 cr.",
        "desc": "Access to the teaching AI, personal timetable (A/B weeks), internal messaging and homework tracking. The balance returns to 700 credits on the first call of each UTC day, and is never lowered when it is higher."
      },
      {
        "title": "Moderator",
        "badge": "Unlimited",
        "desc": "Access to the ALPHA administration console. Moderation privileges: editing user profiles (except the Founder's) and deleting abusive homework or content to keep the community sound."
      },
      {
        "title": "Alpha Founder",
        "badge": "Owner",
        "desc": "Full control of the ecosystem: global administration, real-time database statistics, credit resets and role editing (moderator promotions)."
      }
    ],
    "stack": [
      {
        "title": "Supabase (PostgreSQL & Realtime)",
        "desc": "PostgreSQL database guarded by row-level security (RLS): each account reads only its own rows. That is not end-to-end encryption — the service operator can still read the content, as the privacy policy says. Postgres WebSocket subscriptions sync timetables and messages in real time."
      },
      {
        "title": "Netlify — hosting and CDN",
        "desc": "The site is served and distributed by Netlify (`server: Netlify` header, measured 2026-08-28), with HTTPS/TLS on every route and environment variables kept server-side. There is no Cloudflare layer on this domain: the anti-DDoS and WAF protection is Netlify's, not ours."
      },
      {
        "title": "Two providers, one fallback",
        "desc": "The server calls `gemini-3.6-flash` (Google AI) and falls back to `openai/gpt-oss-20b` via Groq when the first one fails to answer. No other model is wired: Claude 3.5 Sonnet, Gemini 2.5 Flash and Llama 3.3, listed here before, were never called by the code."
      },
      {
        "title": "Next.js (App Router) & Framer Motion",
        "desc": "Modern architecture with hybrid rendering for maximum performance. Smooth animations and state transitions driven by Framer Motion at 60 frames per second."
      }
    ],
    "tiers_kicker": "Ecosystem & grades",
    "tiers_title": "Grade levels & infrastructure",
    "tiers_lede": "Two columns, one rule: what is written here matches code that runs. No promises, no decorative numbers.",
    "note_grades": "The 700-credit floor applies on the first call of each UTC day; a moderator can top up earlier, never the other way round.",
    "note_infra": "Measured on 2026-08-28: server: Netlify header, /api/health probe latencies, replies read back from the import routes.",
    "tagline": "Built on current AI models so that schooling need not stop at a border.",
    "links": [
      "Privacy",
      "Terms",
      "API",
      "Status"
    ]
  },
  es: {
    "roles_title": "Grados y privilegios",
    "stack_title": "Tecnologías y herramientas",
    "roles": [
      {
        "title": "Usuario normal",
        "badge": "700 cr.",
        "desc": "Acceso a la IA pedagógica, gestión del horario personal (semanas A/B), mensajería interna y seguimiento de deberes. El saldo vuelve a 700 créditos con la primera llamada de cada día UTC y nunca se reduce si es mayor."
      },
      {
        "title": "Moderador",
        "badge": "Ilimitado",
        "desc": "Acceso a la consola de administración ALPHA. Privilegios de moderación: editar perfiles de usuario (excepto el del Fundador) y borrar deberes o contenidos abusivos para cuidar la comunidad."
      },
      {
        "title": "Fundador Alpha",
        "badge": "Propietario",
        "desc": "Control total del ecosistema: administración global, estadísticas de la base de datos en tiempo real, reinicio de créditos y edición de roles (promociones a moderador)."
      }
    ],
    "stack": [
      {
        "title": "Supabase (PostgreSQL y Realtime)",
        "desc": "Base de datos PostgreSQL protegida por políticas de nivel de fila (RLS): cada cuenta sólo lee sus propias filas. Eso no es cifrado de extremo a extremo — quien opera el servicio puede leer el contenido, como dice la política de privacidad. Suscripciones WebSocket de Postgres para sincronizar horarios y mensajes en tiempo real."
      },
      {
        "title": "Netlify — alojamiento y CDN",
        "desc": "El sitio lo sirve y distribuye Netlify (cabecera `server: Netlify`, medida el 28/08/2026), con HTTPS/TLS en cada ruta y variables de entorno en el servidor. No hay capa de Cloudflare en este dominio: la protección anti-DDoS y el WAF son los de Netlify, no los nuestros."
      },
      {
        "title": "Dos proveedores, un respaldo",
        "desc": "El servidor llama a `gemini-3.6-flash` (Google AI) y cambia a `openai/gpt-oss-20b` vía Groq si el primero no responde. Ningún otro modelo está conectado: Claude 3.5 Sonnet, Gemini 2.5 Flash y Llama 3.3, citados aquí antes, nunca fueron llamados por el código."
      },
      {
        "title": "Next.js (App Router) y Framer Motion",
        "desc": "Arquitectura moderna con renderizado híbrido para máximo rendimiento. Animaciones y transiciones de estado movidas por Framer Motion a 60 fotogramas por segundo."
      }
    ],
    "tiers_kicker": "Ecosistema y grados",
    "tiers_title": "Niveles de grado e infraestructura",
    "tiers_lede": "Dos columnas, una regla: lo escrito aquí corresponde a código que se ejecuta. Ni promesas ni cifras decorativas.",
    "note_grades": "El mínimo de 700 créditos se aplica con la primera llamada de cada día UTC; un moderador puede recargar antes, nunca al revés.",
    "note_infra": "Medido el 28/08/2026: cabecera server: Netlify, latencias de la sonda /api/health y respuestas leídas en las rutas de importación.",
    "tagline": "Impulsado por los modelos actuales para que estudiar no dependa de una frontera.",
    "links": [
      "Privacidad",
      "Términos",
      "API",
      "Estado"
    ]
  },
  ar: {
    "roles_title": "الرُتب والصلاحيات",
    "stack_title": "التقنيات والأدوات",
    "roles": [
      {
        "title": "مستخدم عادي",
        "badge": "700 اعتماد",
        "desc": "الوصول إلى الذكاء التعليمي، وإدارة جدول الحصص الشخصي (أسابيع أ/ب)، والمراسلة الداخلية، وتتبع الواجبات. يعود الرصيد إلى 700 اعتماد عند أول استدعاء في كل يوم بتوقيت UTC، ولا يُنقص إذا كان أعلى."
      },
      {
        "title": "مشرف",
        "badge": "غير محدود",
        "desc": "الوصول إلى وحدة التحكم ALPHA وصلاحيات الإشراف: تعديل ملفات المستخدمين (باستثناء المؤسس) وحذف الواجبات أو المحتوى المسيء لحماية المجتمع."
      },
      {
        "title": "المؤسس ألفا",
        "badge": "مالك",
        "desc": "تحكم كامل في النظام: إدارة عامة، وإحصاءات قاعدة البيانات في الوقت الفعلي، وإعادة ضبط الاعتمادات وتعديل الأدوار."
      }
    ],
    "stack": [
      {
        "title": "Supabase (PostgreSQL و Realtime)",
        "desc": "قاعدة بيانات PostgreSQL محمية بسياسات مستوى الصف (RLS): كل حساب لا يقرأ إلا صفوفه. هذا ليس تشفيراً من الطرف إلى الطرف — ما زال مشغّل الخدمة يستطيع قراءة المحتوى، كما تقول سياسة الخصوصية. اشتراكات WebSocket لمزامنة الجداول والرسائل فوراً."
      },
      {
        "title": "Netlify — الاستضافة وشبكة التوصيل",
        "desc": "الموقع يقدّمه ويوزّعه Netlify (الترويسة `server: Netlify`، مقيسة في 2026-08-28)، مع HTTPS/TLS على كل مسار ومتغيّرات البيئة محفوظة في الخادم. لا توجد طبقة Cloudflare على هذا النطاق: حماية DDoS وجدار WAF هما الخاصان بـ Netlify."
      },
      {
        "title": "مزوّدان وملاذ واحد",
        "desc": "الخادم يستدعي `gemini-3.6-flash` (Google AI) ويتحوّل إلى `openai/gpt-oss-20b` عبر Groq إذا لم يجب الأول. لا يوجد نموذج آخر موصول: Claude 3.5 Sonnet وGemini 2.5 Flash وLlama 3.3 التي ذُكرت هنا سابقاً لم يستدعها الكود أبداً."
      },
      {
        "title": "Next.js (App Router) و Framer Motion",
        "desc": "بنية حديثة بتحويل هجين لأداء أقصى، وحركات وانتقالات الحالة يحرّكها Framer Motion بستّين صورة في الثانية."
      }
    ],
    "tiers_kicker": "النظام والرُتب",
    "tiers_title": "مستويات الرُتب والبنية التحتية",
    "tiers_lede": "عمودان وقاعدة واحدة: كل ما هو مكتوب هنا يقابل شيفرة تعمل. لا وعود ولا أرقام للزينة.",
    "note_grades": "حدّ 700 اعتماد يُطبَّق عند أول استدعاء في كل يوم UTC؛ يستطيع المشرف إعادة التعبئة قبل ذلك، لا العكس.",
    "note_infra": "قياسات 2026-08-28: الترويسة server: Netlify، أزمنة مسبار ‎/api/health، وردود مقروءة من مسارات الاستيراد.",
    "tagline": "مدعوم بنماذج الذكاء الحالية حتى لا يتوقّف التعلّم عند حدّ جغرافي.",
    "links": [
      "الخصوصية",
      "الشروط",
      "API",
      "الحالة"
    ]
  },
  zh: {
    "roles_title": "等级与权限",
    "stack_title": "技术与工具",
    "roles": [
      {
        "title": "普通用户",
        "badge": "700 额度",
        "desc": "使用教学 AI、管理个人课表（A/B 周）、站内消息与作业记录。每个 UTC 日的首次调用会把余额补足到 700 额度；若余额更高则不会被削减。"
      },
      {
        "title": "管理员",
        "badge": "无限",
        "desc": "可进入 ALPHA 管理台，拥有监督权限：修改用户资料（创始人除外）、删除违规作业或内容，以维护社区秩序。"
      },
      {
        "title": "Alpha 创始人",
        "badge": "所有者",
        "desc": "对整个系统的完全控制：全局管理、实时数据库统计、额度重置、角色调整（晋升管理员）以及直连 AI 控制台。"
      }
    ],
    "stack": [
      {
        "title": "Supabase（PostgreSQL 与 Realtime）",
        "desc": "PostgreSQL 数据库由行级安全策略（RLS）保护：每个账户只能读取自己的数据行。这不是端到端加密——服务运营方仍可读取内容，隐私政策已写明。Postgres 的 WebSocket 订阅用于实时同步课表与消息。"
      },
      {
        "title": "Netlify — 托管与 CDN",
        "desc": "站点由 Netlify 提供并分发（响应头 `server: Netlify`，2026-08-28 实测），每条路由都走 HTTPS/TLS，环境变量保存在服务端。此域名没有 Cloudflare 层：DDoS 防护与 WAF 属于 Netlify，而不是我们。"
      },
      {
        "title": "两个供应商，一个备援",
        "desc": "服务器调用 `gemini-3.6-flash`（Google AI），若其未响应则改用 Groq 上的 `openai/gpt-oss-20b`。没有接入其他模型：此前写在这里的 Claude 3.5 Sonnet、Gemini 2.5 Flash 与 Llama 3.3 从未被代码调用。"
      },
      {
        "title": "Next.js（App Router）与 Framer Motion",
        "desc": "采用混合渲染的现代架构以取得最佳性能；过渡与状态动画由 Framer Motion 驱动，每秒 60 帧。"
      }
    ],
    "tiers_kicker": "生态与等级",
    "tiers_title": "等级与基础设施",
    "tiers_lede": "两栏，一条规则：这里写的都对应正在运行的代码，没有承诺，也没有装饰性数字。",
    "note_grades": "700 额度的下限在每个 UTC 日首次调用时生效；管理员可以提前充值，反之则不行。",
    "note_infra": "2026-08-28 实测：server: Netlify 响应头、/api/health 探针延迟，以及从导入接口读回的响应。",
    "tagline": "由当前的 AI 模型驱动，让学习不受地理边界限制。",
    "links": [
      "隐私",
      "条款",
      "API",
      "状态"
    ]
  }
};
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

/* Texture « grain » de l'en-tête, en URI de données base64 : rien ne sort du domaine.
   L'ancienne version appelait grainy-gradients.vercel.app/noise.svg — un hôte tiers chargé
   sur chaque visite, ce que /privacy ne mentionne pas (« aucun script tiers »). Le SVG fait
   249 octets, il n'appelle ni police ni image externe ; en base64, aucun guillemet à
   négocier entre le JS, le CSS et le SVG. */
const BRUIT = "url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMjAnIGhlaWdodD0nMTIwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC45JyBudW1PY3RhdmVzPSc0JyBzdGl0Y2hUaWxlcz0nc3RpdGNoJy8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9JzEyMCcgaGVpZ2h0PScxMjAnIGZpbHRlcj0ndXJsKCNuKScgb3BhY2l0eT0nMC41Jy8+PC9zdmc+\")";

/* Les six cartes de la grille « Fonctionnalités », dans les cinq langues.
   Avant ce remaniement, le littéral était recréé à chaque rendu dans une IIFE et
   lu par `(featuresData as any)[lang] || featuresData.fr` : deux `any` qui
   laissaient passer une langue absente, un titre manquant ou une puce en trop
   sans que `tsc` bronche, plus 45 lignes d'objets et de JSX réallouées à chaque
   frappe de touche. Il est maintenant au niveau module et typé : une langue
   oubliée est une erreur de compilation, plus une grille silencieusement vide. */
type Carte = { icon: React.ReactNode; title: string; desc: string; list?: string[]; premium?: boolean };

const FEATURES: Record<'fr' | 'en' | 'es' | 'ar' | 'zh', Carte[]> = {
  fr: [
    { icon: <Bot size={28} />, title: "Moncef Intelligence", desc: "L'épicentre de votre savoir : une IA à qui tu soumets un cours, un devoir ou un concept dense, et qui répond.", list: ["Conversation libre sur tes cours", "Analyse de la photo d’un énoncé", "10 crédits par réponse"] },
    { icon: <CalendarDays size={28} />, title: "Flux Temporel IA", desc: "Ton emploi du temps s'importe en une fois — semaines A/B, jours, matières, horaires — et se retrouve sur tous tes appareils.", list: ["Semaines A/B", "Sync Cloud temps réel", "Aucune alerte envoyée"] },
    { icon: <ClipboardList size={28} />, title: "Smart Tracker", desc: "L'assistant lit la photo d'un énoncé et en tire une liste de devoirs, que la route d'import enregistre.", list: ["Photo de l'énoncé analysée", "priority et status rangés tels quels", "Aucun tri, aucun rappel"] },
    { icon: <MessageSquare size={28} />, title: "Cortex Comm", desc: "Une messagerie interne pour le travail en groupe : salons, messages privés et pièces jointes, cloisonnés par compte.", list: ["Salons de Travail", "Messages Privés", "Partage de Fichiers"] },
    { icon: <ShieldCheck size={28} />, title: "ALPHA ENGINE", desc: "L'interface d'administration ultime. Un contrôle total sur l'écosystème avec des analyses en temps réel.", premium: true, list: ["Statistiques et comptes en direct", "Analytics avancés", "Aucune console IA dans ce panneau"] },
    { icon: <Star size={28} />, title: "Modération 2.0", desc: "Des outils sophistiqués pour maintenir l'intégrité et la sécurité de la communauté Moncef IA.", list: ["Gestion des Rôles", "Recharge et suppression de comptes", "Accès founder et moderator seulement"] }
  ],
  en: [
    { icon: <Bot size={28} />, title: "Moncef Intelligence", desc: "The epicenter of your knowledge: an AI you hand a course, a piece of work or a dense concept, and that answers.", list: ["Open conversation about your courses", "Analysis of a question photo", "10 credits per answer"] },
    { icon: <CalendarDays size={28} />, title: "AI Time Flow", desc: "Your timetable is imported in one pass — A/B weeks, days, subjects, time slots — and shows up on all your devices.", list: ["A/B Weeks", "Real-time cloud sync", "No alert is sent"] },
    { icon: <ClipboardList size={28} />, title: "Smart Tracker", desc: "The assistant reads a photo of a question sheet and turns it into a homework list, which the import route stores.", list: ["Question photo analysed", "priority and status stored as given", "No sorting, no reminders"] },
    { icon: <MessageSquare size={28} />, title: "Cortex Comm", desc: "Internal messaging for group work: rooms, private messages and attachments, separated per account.", list: ["Work Rooms", "Private DMs", "File Sharing"] },
    { icon: <ShieldCheck size={28} />, title: "ALPHA ENGINE", desc: "The ultimate administration interface. Total control over the ecosystem with real-time analytics.", premium: true, list: ["Live stats and accounts", "Advanced analytics", "No AI console in this panel"] },
    { icon: <Star size={28} />, title: "Moderation 2.0", desc: "Sophisticated tools to maintain the integrity and security of the Moncef IA community.", list: ["Role Management", "Top-up and account deletion", "founder and moderator access only"] }
  ],
  es: [
    { icon: <Bot size={28} />, title: "Moncef Intelligence", desc: "El epicentro de tu conocimiento: una IA a la que entregas un curso, un trabajo o un concepto denso, y responde.", list: ["Conversación libre sobre tus cursos", "Análisis de la foto de un enunciado", "10 créditos por respuesta"] },
    { icon: <CalendarDays size={28} />, title: "Flujo Temporal IA", desc: "Tu horario se importa de una vez — semanas A/B, días, materias y franjas — y aparece en todos tus dispositivos.", list: ["Semanas A/B", "Sincronización en la nube", "No se envía ninguna alerta"] },
    { icon: <ClipboardList size={28} />, title: "Smart Tracker", desc: "El asistente lee la foto de un enunciado y la convierte en una lista de deberes que la ruta de importación guarda.", list: ["Foto del enunciado analizada", "priority y status guardados tal cual", "Sin orden ni recordatorios"] },
    { icon: <MessageSquare size={28} />, title: "Cortex Comm", desc: "Mensajería interna para trabajar en grupo: salas, mensajes privados y adjuntos, separados por cuenta.", list: ["Salas de Trabajo", "Mensajes Privados", "Compartir Archivos"] },
    { icon: <ShieldCheck size={28} />, title: "ALPHA ENGINE", desc: "La interfaz de administración definitiva. Control total sobre el ecosistema con análisis en tiempo real.", premium: true, list: ["Estadísticas y cuentas en vivo", "Analítica avanzada", "Ninguna consola de IA aquí"] },
    { icon: <Star size={28} />, title: "Moderación 2.0", desc: "Herramientas sofisticadas para mantener la integridad y seguridad de la comunidad Moncef IA.", list: ["Gestión de Roles", "Recarga y borrado de cuentas", "Solo acceso founder y moderator"] }
  ],
  ar: [
    { icon: <Bot size={28} />, title: "ذكاء منصف", desc: "مركز معرفتك: ذكاء اصطناعي تمنحه درساً أو عملاً أو مفهوماً معقداً فيجيب.", list: ["محادثة حرة حول دروسك", "تحليل صورة نصّ التمرين", "10 اعتمادات لكل ردّ"] },
    { icon: <CalendarDays size={28} />, title: "تدفق زمني ذكي", desc: "يُستورد جدولك دفعة واحدة — أسابيع أ/ب، الأيام، المواد والتوقيتات — ويظهر على كل أجهزتك.", list: ["أسابيع أ/ب", "مزامنة سحابية فورية", "لا تُرسل أي تنبيهات"] },
    { icon: <ClipboardList size={28} />, title: "تتبع ذكي", desc: "يقرأ المساعد صورة نصّ التمرين ويحوّله إلى قائمة واجبات تحفظها مسار الاستيراد.", list: ["تحليل صورة نصّ التمرين", "priority وstatus يُحفظان كما هما", "بلا ترتيب ولا تذكيرات"] },
    { icon: <MessageSquare size={28} />, title: "اتصالات كورتيكس", desc: "مراسلة داخلية للعمل الجماعي: غرف ورسائل خاصة ومرفقات، مفصولة لكل حساب.", list: ["غرف عمل", "رسائل خاصة", "مشاركة الملفات"] },
    { icon: <ShieldCheck size={28} />, title: "محرك ألفا", desc: "واجهة الإدارة المطلقة. تحكم كامل في النظام البيئي مع تحليلات في الوقت الفعلي.", premium: true, list: ["إحصاءات وحسابات مباشرة", "تحليلات متقدمة", "لا توجد وحدة تحكم IA هنا"] },
    { icon: <Star size={28} />, title: "إشراف 2.0", desc: "أدوات متطورة للحفاظ على نزاهة وأمان مجتمع ذكاء منصف.", list: ["إدارة الأدوار", "إعادة تعبئة وحذف الحسابات", "الوصول founder و moderator فقط"] }
  ],
  zh: [
    { icon: <Bot size={28} />, title: "Moncef 智能", desc: "知识的核心：把课程、作业或复杂概念交给它，它来回答。", list: ["围绕课程自由对话", "分析题目照片", "每次回答 10 额度"] },
    { icon: <CalendarDays size={28} />, title: "AI 时间流", desc: "课程表一次性导入——A/B 周、星期、科目与时间——并在你的所有设备上同步显示。", list: ["A/B 周", "实时云同步", "不发送任何提醒"] },
    { icon: <ClipboardList size={28} />, title: "智能追踪器", desc: "助手读取题目照片并整理成作业清单，由导入接口写入。", list: ["题目照片分析", "priority 与 status 原样写入", "不排序、不提醒"] },
    { icon: <MessageSquare size={28} />, title: "Cortex 通信", desc: "面向课堂协作的内部消息：讨论区、私信与附件，按账户隔离。", list: ["讨论区", "私信", "文件分享"] },
    { icon: <ShieldCheck size={28} />, title: "ALPHA 引擎", desc: "终极管理界面。通过实时分析全面控制生态系统。", premium: true, list: ["实时统计与账户", "高级分析", "此处没有 AI 控制台"] },
    { icon: <Star size={28} />, title: "审核 2.0", desc: "维护 Moncef IA 社区完整性和安全性的高级工具。", list: ["角色管理", "充值与删除账户", "仅 founder 与 moderator 可访问"] }
  ]
};;

export default function Home() {
  const router = useRouter();

  // Un échec de connexion OAuth revient ici, sur la racine, avec ?error_code / ?error_description
  // (Supabase redirige ses erreurs vers `site_url`, pas vers /auth/callback). Sans ce garde,
  // l'utilisateur restait sur la page vitrine sans aucun message : on le renvoie vers /auth
  // en conservant la query, où le message est affiché.
  useEffect(() => {
    const search = window.location.search;
    if (hasOAuthError(search)) router.replace(authUrlWithError(search));
  }, [router]);

  const { user, setUser, credits, setCredits } = useUserStore();
  const [lang, setLang] = useState("fr");
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const heroRef = useRef<any>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const heroScale   = useTransform(scrollYProgress, [0, 0.8], [1, 0.95]);

  // GSAP + ScrollTrigger étaient chargés pour une seule animation : `gsap.from(".card-gsap",
  // { opacity: 0, … })`. Ce qui est en train de disparaître ``from`` : l''état de repos des cartes
  // devenait invisible, et seule la rencontre du seuil de scroll le corrigeait. Un aperçu dans un
  // cadre, un conteneur de scroll qui n''est pas la fenêtre, ou le chunk monté après l''effet, et la
  // grille restait vide à l''écran alors que le HTML, lui, contenait bien les six cartes.
  // L''entrée en scène est maintenant faite par Framer Motion avec `animate` (déclenché au montage,
  // pas à l'observation) — voir <FeatureCard>. Le paquet gsap reste dans package.json pour les
  // autres pages, il n'est plus importé ici.

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
          const { data: meRows } = await supabase.rpc('get_me');
            const profile = meRows?.[0] ?? null;
          if (profile) {
            setUser(profile);
            setCredits(profile.tokens);
          }
        }
      } catch (err: any) {
        console.error("Error loading user:", err);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [setUser, setCredits]);

  const switchLang = (l: any) => {
    setLang(l);
    localStorage.setItem("site_lang", l);
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    setShowLangSelector(false);
  };

  const v = VITRINE[lang as keyof typeof VITRINE] ?? VITRINE.fr;
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
        <div style={{ position: "absolute", inset: 0, opacity: 0.02, backgroundImage: BRUIT }} />
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
                {firstWords.split(" ").map((word: any, i: any) => (
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
      <section id="features" style={{ background: "rgba(0,0,0,0.2)", borderTop: "1px solid var(--border)" }}>
        <div className="landing-section features-container">
          <div style={{ textAlign: "center", marginBottom: 80 }}>
            <span style={{ background: "var(--p-g)", color: "#fff", fontSize: 12, fontWeight: 900, padding: "6px 16px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.1em" }}>ULTIMATE TOOLS</span>
            <h2 style={{ fontSize: "clamp(36px, 5vw, 64px)", marginTop: 24, letterSpacing: "-0.04em", fontFamily: "var(--font2)" }}>{t(lang, "feat_title")}</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 18, maxWidth: 600, margin: "16px auto 0" }}>{t(lang, "feat_desc")}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, maxWidth: 1300, margin: "0 auto" }}>
            {(FEATURES[lang as keyof typeof FEATURES] ?? FEATURES.fr).map((feat, idx) => (
              <FeatureCard
                key={feat.title}
                icon={feat.icon}
                title={feat.title}
                desc={feat.desc}
                list={feat.list}
                premium={feat.premium}
                /* Le cumul de flottants écrivait « 0.30000000000000004s » dans le DOM ;
                   on arrondit au centième de seconde. */
                delay={Math.round((0.1 + idx * 0.1) * 100) / 100}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── NIVEAUX DE GRADE & INFRASTRUCTURE ── */}
      {/* Deux colonnes, un seul état possible : visible. L'entrée en scène est une
          animation CSS (@keyframes rise-in) dont la dernière image est l'état au repos ;
          elle ne dépend ni d'un IntersectionObserver (whileInView), ni de ScrollTrigger.
          Le contenu vient du dictionnaire VITRINE, donc les 5 langues ont la même mise en
          page — et s'il manque une langue, on retombe sur le français, jamais sur du vide. */}
      <section id="tiers-tech" style={{ padding: "110px 24px", background: "rgba(0,0,0,0.3)", borderTop: "1px solid var(--border)", position: "relative" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div className="rise-in" style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ background: "var(--p-g)", color: "#fff", fontSize: 12, fontWeight: 900, padding: "6px 16px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {v.tiers_kicker}
            </span>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 50px)", marginTop: 18, fontFamily: "var(--font2)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {v.tiers_title}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 16, maxWidth: 640, margin: "14px auto 0", lineHeight: 1.6 }}>
              {v.tiers_lede}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24, alignItems: "start" }}>

            {/* — Colonne 1 : les trois grades, en lignes comparables — */}
            <div className="rise-in vitrine-panel" style={{ animationDelay: "0.06s" }}>
              <h3 className="vitrine-panel-title">
                <span className="vitrine-chip" data-tone="gold"><Crown size={16} /></span>
                {v.roles_title}
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {v.roles.map((r, i) => (
                  <div key={r.title} className="grade-row" data-tone={i === 2 ? "gold" : i === 1 ? "violet" : "plain"}>
                    <div className="grade-row-head">
                      <span aria-hidden="true" className="grade-glyph">{["👤", "🛡️", "👑"][i]}</span>
                      <h4 className="grade-name">{r.title}</h4>
                      <span className="grade-badge">{r.badge}</span>
                    </div>
                    <p className="grade-desc">{r.desc}</p>
                  </div>
                ))}
              </div>

              <p className="vitrine-footnote">{v.note_grades}</p>
            </div>

            {/* — Colonne 2 : la pile technique, en carte par brique — */}
            <div className="rise-in vitrine-panel" style={{ animationDelay: "0.12s" }}>
              <h3 className="vitrine-panel-title">
                <span className="vitrine-chip"><Zap size={16} /></span>
                {v.stack_title}
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {v.stack.map((b, i) => (
                  <div key={b.title} className="infra-item">
                    <span className="infra-icon">
                      {i === 0 ? <Database size={16} /> : i === 1 ? <Globe size={16} /> : i === 2 ? <Bot size={16} /> : <Lock size={16} />}
                    </span>
                    <h4 className="infra-name">{b.title}</h4>
                    <p className="infra-desc">{b.desc}</p>
                  </div>
                ))}
              </div>

              <p className="vitrine-footnote">{v.note_infra}</p>
            </div>

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
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, maxWidth: 400, margin: "0 auto 40px" }}>{v.tagline}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 40 }}>
            {[
              { name: v.links[0], href: "/privacy" },
              { name: v.links[1], href: "/terms" },
              { name: v.links[2], href: "/api-docs" },
              { name: v.links[3], href: "/status" }
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

/* Le `delay` descendait jusqu'à TiltCard qui le détruisait sans jamais s'en servir
   (l'effet venait de gsap, retiré ici). Il pilote maintenant une animation CSS :
   les cartes entrent en cascade, et — différence essentielle avec gsap.from — leur
   état au repos est opacity: 1 ; c'est l'image de départ qui est invisible. */
function FeatureCard({ icon, title, desc, list = [], premium = false, delay }: { icon: React.ReactNode, title: string, desc: string, list?: string[] | undefined, premium?: boolean | undefined, delay: number }) {
  return (
    <TiltCard className="card card-gsap rise-in-fade" style={{ padding: "48px 32px", position: "relative", overflow: "hidden", animationDelay: `${delay}s` }}>
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

