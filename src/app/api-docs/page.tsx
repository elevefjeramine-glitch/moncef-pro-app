"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Terminal, ArrowLeft, Key, Copy, Check, Coins, ShieldAlert, HeartPulse, Trash2, Send, CalendarDays, BookOpen, Lock } from "lucide-react";
import dynamic from "next/dynamic";

const LanguageSwitcher = dynamic(() => import("@/components/LanguageSwitcher"), { ssr: false });

// Ce fichier est volontairement une transcription du code, pas une vitrine.
// Origine des exemples : scripts /home/user/capture-contrats*.py exécutés contre
// https://proappmoncef.netlify.app le 2026-08-28, relevés bruts dans
// /home/user/api-capture/. Les libellés techniques (noms de champs, messages
// d'erreur, solde de crédits) ne sont PAS traduits : ils sont copiés du code,
// et une traduction ferait dériver la doc de la réalité.

type RouteDoc = {
  id: string;
  method: "POST" | "GET";
  path: string;
  icon: any;
  req: Record<string, unknown> | null;
  res: unknown;
  res2?: unknown;
  variants?: { label: string; body: Record<string, unknown>; res: Record<string, unknown> }[];
  fields: [string, string, string, string][];
  errors: [string, string][];
  notes?: string[];
};

const ROUTES: RouteDoc[] = [
  {
    id: "chat",
    method: "POST",
    path: "/api/chat",
    icon: Send,
    req: {
      messages: [
        { role: "user", content: "Réponds par un seul mot : quelle est la capitale du Maroc ?" },
      ],
      system: "Tu es un tuteur. Réponds en français.",
    },
    res: { response: "Rabat", newTokens: 690 },
    fields: [
      ["messages", "array", "oui", "Liste non vide. Chaque élément : { role: 'user' | 'assistant', content: string | array }."],
      ["messages[].content", "string | array", "oui", "Soit une chaîne, soit une liste de parties { type:'text', text } et { type:'image_url', image_url:{ url:'data:<mime>;base64,...' } }."],
      ["system", "string", "non", "Consigne système. La date du jour et l'identité « Moncef IA » sont ajoutées côté serveur."],
    ],
    errors: [
      ["400", 'Corps de requête illisible : du JSON est attendu.'],
      ["400", 'Champ `messages` attendu : une liste non vide.'],
      ["401", "Authentification requise pour utiliser l'IA.  (aucun en-tête Authorization)"],
      ["401", "Session invalide ou expirée.  (jeton refusé par Supabase)"],
      ["402", "Plus de crédits pour aujourd'hui.  (solde à 0, voir la section Crédits)"],
      ["410", "Compte supprimé, comme demandé.  (suppression programmée arrivée à échéance)"],
      ["500", "Aucune clé API trouvée. Configurez GEMINI_API_KEY ou GROQ_API_KEY..."],
    ],
    notes: [
      "Le champ `model` n'existe pas : le serveur choisit. Modèle principal `gemini-3.6-flash` (Google), secours `openai/gpt-oss-20b` via Groq, essayés dans cet ordre jusqu'au premier qui répond.",
      "Chaque réponse réussie coûte 10 crédits. Un échec du modèle ne débite rien.",
      "Une image passe en `inlineData` au modèle ; le format accepté est une data URL base64 dans une partie `image_url`.",
      "Timeout de 20 s par appel fournisseur, une tentative supplémentaire sur erreur réseau, 429, 502, 503, 504.",
    ],
  },
  {
    id: "homework",
    method: "POST",
    path: "/api/homework-import",
    icon: BookOpen,
    req: {
      entries: [
        {
          subject: "Mathématiques",
          task: "Exercices 1 à 4 page 88",
          teacher: "M. Benali",
          priority: "high",
          status: "todo",
          progression: 0,
          due_date: "2026-09-05",
        },
      ],
    },
    res: { success: true, inserted: 1, updated: 0 },
    res2: { success: true, inserted: 0, updated: 1 },
    fields: [
      ["entries", "array", "oui", "Non vide, sinon 400. Un élément sans `id` est inséré, un élément avec `id` est mis à jour."],
      ["entries[].subject", "string", "oui", "Matière."],
      ["entries[].task", "string", "oui", "La colonne est NOT NULL : son absence renvoie une erreur Postgres."],
      ["entries[].teacher", "string", "non", "Défaut : chaîne vide."],
      ["entries[].priority", "string", "non", "Défaut : 'normal'."],
      ["entries[].status", "string", "non", "Défaut : 'todo'. 'done' force progression à 100 et is_done à true."],
      ["entries[].progression", "number", "non", "Défaut : 0."],
      ["entries[].due_date", "string", "non", "Date ISO (YYYY-MM-DD), sinon null."],
      ["entries[].id", "uuid", "non", "Présent = mise à jour de CE devoir-là, dans la limite d'un par requête."],
    ],
    errors: [
      ["400", "Aucun devoir à importer"],
      ["401", "Utilisateur non authentifié"],
      ["410", "Compte supprimé, comme demandé."],
      ["500", 'null value in column "task" of relation "homework" violates not-null constraint'],
    ],
    notes: [
      "Champs inconnus : ignorés. Un `colonne_qui_nexiste_pas: 1` a renvoyé inserted:1 sans avertissement (relevé du 2026-08-28) — l'API ne valide pas la forme, elle projette les champs qu'elle connaît.",
      "Pas de suppression par cette route : l'effacement d'un devoir se fait dans l'application ou par le panneau Alpha.",
    ],
  },
  {
    id: "schedule",
    method: "POST",
    path: "/api/schedule-import",
    icon: CalendarDays,
    req: {
      entries: [
        { week: "A", day_index: 0, subj: "Physique", time_slot: "08:00-09:00" },
        { week: "B", day_index: 4, subj: "EPS" },
      ],
    },
    res: { success: true, inserted: 2, action: "insert" },
    variants: [
      { label: "update", body: { action: "update", entries: [{ id: "…", subj: "Physique chimie" }] }, res: { success: true, updated: 1, action: "update" } },
      { label: "delete", body: { action: "delete", entries: [{ id: "…" }] }, res: { success: true, deleted: 1, action: "delete" } },
    ],
    fields: [
      ["entries", "array", "oui", "Pour insert : non vide. Pour delete : seuls les `id` comptent."],
      ["action", "string", "non", "'insert' (défaut si absent), 'update' ou 'delete'. Toute autre valeur : 400."],
      ["entries[].week", "string", "non", "Défaut : 'A'."],
      ["entries[].day_index", "number", "oui pour insert", "0 = lundi, jusqu'à 4 en pratique."],
      ["entries[].subj", "string", "oui pour insert", "Matière affichée."],
      ["entries[].time_slot", "string", "non", "Défaut : chaîne vide."],
      ["entries[].id", "uuid", "oui pour update/delete", "Doit appartenir au compte appelant, sinon rien n'est touché (aucune erreur)."],
    ],
    errors: [
      ["400", "Aucune entrée à importer"],
      ["400", "Aucun ID à supprimer"],
      ["400", "Aucune modification"],
      ["400", "Action inconnue"],
      ["401", "Utilisateur non authentifié"],
      ["500", "message Postgres renvoyé tel quel en cas de refus de la base"],
    ],
    notes: [
      "insert ne remplace pas l'emploi du temps : il ajoute des lignes. Pour repartir de zéro, supprimer les ids existants puis insérer.",
      "update et delete répondent un compteur ; une id qui n'appartient pas au compte est ignorée silencieusement (compteur plus bas que le nombre envoyé).",
    ],
  },
  {
    id: "events",
    method: "POST",
    path: "/api/events-import",
    icon: HeartPulse,
    req: {
      entries: [
        {
          title: "Contrôle de SVT",
          description: "Chapitre génétique",
          event_date: "2026-09-12",
          event_time: "10:00",
          category: "exam",
        },
      ],
    },
    res: { success: true, inserted: 1 },
    fields: [
      ["entries", "array", "oui", "Non vide, sinon 400."],
      ["entries[].title", "string", "oui", "Intitulé de l'événement."],
      ["entries[].description", "string", "non", "Défaut : chaîne vide."],
      ["entries[].event_date", "string", "oui", "Date ISO. Une valeur non parsable est refusée par Postgres (500)."],
      ["entries[].event_time", "string", "non", "Défaut : chaîne vide."],
      ["entries[].category", "string", "non", "Défaut : 'general'. Couleurs appliquées automatiquement : exam #ff4757, homework #ffa502, meeting #a78bfa, trip #2ed573, sport #00D2B6, reminder #FFD700, general #2e5bff."],
    ],
    errors: [
      ["400", "Aucun événement à importer"],
      ["401", "Utilisateur non authentifié"],
      ["500", 'invalid input syntax for type date: "demain"'],
      ["503", "La table 'events' n'existe pas encore...  (branche prévue pour un projet sans la migration 0002 ; ici la table existe, elle n'est pas déclenchée)"],
    ],
    notes: [
      "La couleur est déduite de la catégorie côté serveur : inutile — et impossible — de l'imposer depuis l'API.",
    ],
  },
  {
    id: "deletion",
    method: "POST",
    path: "/api/account/delete",
    icon: Trash2,
    req: { confirm: true },
    res: {
      success: true,
      scheduled: true,
      deletionScheduledAt: "2026-09-04T21:00:00.000Z",
      graceDays: 7,
    },
    fields: [
      ["confirm", "boolean", "oui pour programmer", "Doit valoir exactement true, sinon 400 sans effet."],
      ["cancel", "boolean", "non", "true = retire une demande en cours. Réponse : { success: true, cancelled: true, deletionScheduledAt: null }."],
    ],
    errors: [
      ["400", "Confirmation requise : envoyez { \"confirm\": true } pour programmer la suppression définitive dans 7 jours."],
      ["401", "Jeton manquant : en-tête Authorization: Bearer requis."],
      ["401", "Session invalide ou expirée."],
    ],
    notes: [
      "GET sur le même chemin renvoie l'état : { deletionScheduledAt, graceDays, role }. null = aucune demande en cours.",
      "La réponse à une demande enumerate aussi les tables touchées (champ willDelete) et, pour un compte founder ou moderator, un avertissement (champ warnings).",
      "Quand la purge est-elle exécutée ? Au premier appel de /api/chat après l'échéance, ou sur demande par un modérateur (action Alpha PURGE_DUE_DELETIONS, qui traite toute la file d'attente).",
    ],
  },
  {
    id: "health",
    method: "GET",
    path: "/api/health",
    icon: HeartPulse,
    req: null,
    res: {
      status: "ok",
      observedAt: "2026-08-28T21:00:00.000Z",
      durationMs: 84,
      checks: [
        { key: "database", label: "Base de données (PostgREST)", ok: true, latencyMs: 41, detail: "HTTP 200 en 41 ms" },
        { key: "auth", label: "Authentification (GoTrue)", ok: true, latencyMs: 43, detail: "HTTP 200 en 43 ms" },
        { key: "ai", label: "Modèle IA", ok: true, latencyMs: null, detail: "clé GEMINI_API_KEY présente — appel réel non effectué pour ne pas débiter de crédits" },
      ],
    },
    fields: [
      ["aucune authentification", "—", "—", "Route publique et sans effet de bord : elle ne lit aucun compte, ne renvoie aucune donnée utilisateur."],
    ],
    errors: [["500", "impossible en pratique : chaque sonde est encapsulée, un échec devient ok:false dans checks"]],
    notes: [
      "Latences mesurées depuis le serveur de l'application, pas depuis ton navigateur : elles incluent donc le trajet Netlify → base. La page /status ajoute les mesures du navigateur.",
      "Aucun pourcentage de disponibilité n'est calculé ici, parce qu'aucune sonde historique n'existe : afficher du 99,9 % serait un chiffre inventé.",
    ],
  },
];

const ALPHA = {
  method: "POST",
  path: "/api/alpha",
  actions: [
    "GET_STATS", "GET_USERS", "UPDATE_USER", "RESET_TOKENS",
    "GET_ALL_HOMEWORK", "DELETE_HOMEWORK", "DELETE_USER", "PURGE_DUE_DELETIONS",
  ],
};

const content = {
  fr: {
    title: "Documentation de l'API",
    subtitle: "Établie le 28 août 2026 sur le code déployé et sur des appels réellement exécutés en production.",
    intro: "Six routes publiques, un seul mode d'authentification, aucun format maison : tout ce qui suit a été relevé en appelant le serveur. Les messages d'erreur sont cités mot pour mot, les champs inconnus sont décrits tels qu'ils sont traités.",
    base: "URL de base",
    base_hint: "Toutes les routes sont sur le même domaine que le site. Les exemples ci-dessous utilisent déjà cette origine.",
    auth_title: "Authentification",
    auth_1: "En-tête HTTP :",
    auth_2: "Forme historique, acceptée par les trois routes d'import :",
    auth_3: "Obtenir un jeton (connexion par mot de passe, réponse mesurée : expires_in = 3600 s) :",
    auth_note: "Le jeton est le access_token émis par Supabase. Aucune clé API dédiée n'existe : un jeton expiré donne 401, il faut se reconnecter.",
    credits_title: "Crédits",
    credits: [
      ["Plancher quotidien", "700 crédits portés au solde au premier appel d'une journée UTC. Un solde plus élevé n'est jamais réduit."],
      ["Coût d'un appel IA", "10 crédits, décomptés seulement après une réponse reçue."],
      ["Comptes founder et moderator", "Non débités (crédits illimités dans l'interface)."],
      ["Recharge d'un compte", "Manuelle, par un modérateur : action Alpha RESET_TOKENS."],
    ],
    endpoints_title: "Routes",
    request: "Corps de la requête",
    response: "Réponse relevée en production",
    response2: "Réponse d'une mise à jour",
    fields: "Champs attendus",
    field: "champ",
    type: "type",
    required: "requis",
    comment: "remarque",
    errors_title: "Réponses d'erreur",
    code: "code",
    message: "message renvoyé",
    notes_title: "À savoir",
    variant: "variante",
    alpha_title: "Route d'administration (réservée)",
    alpha_body: "Ce n'est pas une API publique : elle sert le panneau d'administration de l'application. Elle exige un compte dont le rôle est founder ou moderator, relu côté serveur — un compte normal reçoit 403 Accès refusé, quel que soit l'en-tête envoyé. Actions admises :",
    limits_title: "Limites réelles et zones fragiles",
    limits: [
      "Aucune limite de débit codée, aucune taille maximale de corps vérifiée : la borne réelle est le quota du fournisseur IA.",
      "Aucune versionnement d'API : le chemin est le chemin. Une modification future cassera les clients, sans dépréciation annoncée.",
      "Les routes d'import ne valident pas le type des champs : une date invalide remonte sous forme d'erreur Postgres en 500, pas sous forme de 400 pédagogique.",
      "Pas de webhook ni de streaming : une réponse IA arrive d'un bloc.",
      "Aucune donnée d'élève n'est lisible par un autre élève : les politiques de la base portent sur auth.uid() = user_id. La route d'import écrit toujours pour le compte du jeton présenté, jamais pour un user_id fourni dans le corps.",
    ],
    back: "Retour à l'accueil",
    status: "État du service",
    privacy: "Confidentialité",
    copied: "Copié !",
    copy: "Copier",
    try_it: "Le corps de réponse est un relevé, pas un modèle : les réponses IA varient, la forme du JSON ne varie pas.",
    required_word: "oui",
    optional_word: "non",
  },
  en: {
    title: "API documentation",
    subtitle: "Written on 2026-08-28 from the deployed code and from calls actually executed against production.",
    intro: "Six public routes, one authentication scheme, no invented formats: everything below was captured by calling the server. Error messages are quoted verbatim, and unknown fields are described as they are really handled.",
    base: "Base URL",
    base_hint: "Every route lives on the same origin as the site. The examples below already use that origin.",
    auth_title: "Authentication",
    auth_1: "HTTP header:",
    auth_2: "Historic form, accepted by the three import routes:",
    auth_3: "Getting a token (password sign-in, measured response: expires_in = 3600 s):",
    auth_note: "The token is the Supabase access_token. There is no separate API key: an expired token returns 401 and you sign in again.",
    credits_title: "Credits",
    credits: [
      ["Daily floor", "700 credits are applied to the balance on the first call of a UTC day. A higher balance is never reduced."],
      ["Cost of one AI call", "10 credits, deducted only once an answer has been received."],
      ["founder and moderator accounts", "Never charged (unlimited credits in the interface)."],
      ["Topping up an account", "Manually, by a moderator: Alpha action RESET_TOKENS."],
    ],
    endpoints_title: "Routes",
    request: "Request body",
    response: "Response captured in production",
    response2: "Update response",
    fields: "Expected fields",
    field: "field",
    type: "type",
    required: "required",
    comment: "note",
    errors_title: "Error responses",
    code: "code",
    message: "message returned",
    notes_title: "Worth knowing",
    variant: "variant",
    alpha_title: "Administration route (restricted)",
    alpha_body: "Not a public API: it powers the app's admin panel. It requires an account whose role is founder or moderator, re-read on the server — a normal account gets 403 Accès refusé whatever header is sent. Accepted actions:",
    limits_title: "Limits and rough edges",
    limits: [
      "No rate limit in the code and no request-size check: the real ceiling is the AI provider's quota.",
      "No API versioning: the path is the path. A future change breaks clients, with no announced deprecation.",
      "The import routes don't type-check fields: a bad date surfaces as a Postgres 500, not as a helpful 400.",
      "No webhooks, no streaming: an AI answer arrives in one block.",
      "No student can read another student's data: the database policies are auth.uid() = user_id. Import routes always write for the account owning the presented token, never for a user_id in the body.",
    ],
    back: "Back to home",
    status: "Service status",
    privacy: "Privacy",
    copied: "Copied!",
    copy: "Copy",
    try_it: "The response bodies are captures, not templates: AI answers vary, the JSON shape does not.",
    required_word: "yes",
    optional_word: "no",
  },
  es: {
    title: "Documentación de la API",
    subtitle: "Redactada el 28/08/2026 a partir del código desplegado y de llamadas ejecutadas de verdad en producción.",
    intro: "Seis rutas públicas, un solo modo de autenticación, ningún formato inventado: todo lo siguiente se obtuvo llamando al servidor. Los mensajes de error se citan literalmente y los campos desconocidos se describen tal como se tratan.",
    base: "URL base",
    base_hint: "Todas las rutas están en el mismo dominio que el sitio. Los ejemplos ya usan ese origen.",
    auth_title: "Autenticación",
    auth_1: "Cabecera HTTP:",
    auth_2: "Forma histórica, aceptada por las tres rutas de importación:",
    auth_3: "Obtener un token (inicio de sesión con contraseña, medido: expires_in = 3600 s):",
    auth_note: "El token es el access_token de Supabase. No existe clave de API propia: un token caducado devuelve 401 y hay que volver a iniciar sesión.",
    credits_title: "Créditos",
    credits: [
      ["Mínimo diario", "Se aplican 700 créditos al primer aviso de un día UTC. Un saldo mayor nunca se reduce."],
      ["Coste de una llamada IA", "10 créditos, descontados solo cuando la respuesta se ha recibido."],
      ["Cuentas founder y moderator", "Sin descuento (créditos ilimitados en la interfaz)."],
      ["Recargar una cuenta", "Manual, por un moderador: acción de Alpha RESET_TOKENS."],
    ],
    endpoints_title: "Rutas",
    request: "Cuerpo de la solicitud",
    response: "Respuesta capturada en producción",
    response2: "Respuesta de actualización",
    fields: "Campos esperados",
    field: "campo",
    type: "tipo",
    required: "obligatorio",
    comment: "nota",
    errors_title: "Respuestas de error",
    code: "código",
    message: "mensaje devuelto",
    notes_title: "Conviene saberlo",
    variant: "variante",
    alpha_title: "Ruta de administración (restringida)",
    alpha_body: "No es una API pública: alimenta el panel de administración. Exige una cuenta con rol founder o moderator, comprobado en el servidor — una cuenta normal recibe 403 Accès refusé sea cual sea la cabecera. Acciones admitidas:",
    limits_title: "Límites y zonas frágiles",
    limits: [
      "Sin límite de peticiones en el código ni comprobación de tamaño: el techo real es la cuota del proveedor de IA.",
      "Sin versionado de API: la ruta es la ruta. Un cambio futuro romperá a los clientes, sin aviso de obsolescencia.",
      "Las rutas de importación no validan tipos: una fecha inválida llega como error Postgres 500, no como un 400 útil.",
      "Sin webhooks ni streaming: la respuesta de IA llega de golpe.",
      "Ningún alumno puede leer los datos de otro: las políticas de la base son auth.uid() = user_id. Las rutas de importación escriben siempre para la cuenta del token presentado, nunca para un user_id del cuerpo.",
    ],
    back: "Volver al inicio",
    status: "Estado del servicio",
    privacy: "Privacidad",
    copied: "¡Copiado!",
    copy: "Copiar",
    try_it: "Los cuerpos de respuesta son capturas, no plantillas: las respuestas de la IA varían, la forma del JSON no.",
    required_word: "sí",
    optional_word: "no",
  },
  ar: {
    title: "وثيقة واجهة البرمجة",
    subtitle: "كُتبت في 28 غشت 2026 انطلاقًا من الكود المنشور ومن استدعاءات نُفِّذت فعلًا في الإنتاج.",
    intro: "ست مسارات عمومية، ونمط واحد للمصادقة، ولا شيء مُتخيَّل: كل ما يلي تم قياسه بالاتصال بالخادم. رسائل الأخطاء منقولة حرفيًا، والحقول المجهولة موصوفة كما تُعالَج فعلًا.",
    base: "العنوان الأساس",
    base_hint: "كل المسارات على نفس نطاق الموقع. والأمثلة أدناه تستعمل هذا العنوان أصلًا.",
    auth_title: "المصادقة",
    auth_1: "ترويسة HTTP:",
    auth_2: "الشكل التاريخي المقبول في مسارات الاستيراد الثلاثة:",
    auth_3: "الحصول على رمز (الدخول بكلمة السر، قياسًا: expires_in = 3600 ثانية):",
    auth_note: "الرمز هو access_token الذي يصدره Supabase. لا يوجد مفتاح API مستقل: الرمز المنتهي يعيد 401 ويُعاد الدخول.",
    credits_title: "الرصيد",
    credits: [
      ["الحد اليومي", "يُرفع الرصيد إلى 700 عند أول طلب في يوم بتوقيت UTC. رصيد أعلى لا يُنقَص أبدًا."],
      ["تكلفة طلب الذكاء", "10 رصيد، تُخصم بعد التوصل بالجواب فقط."],
      ["حسابا founder و moderator", "غير مخصوم منهما (رصيد غير محدود في الواجهة)."],
      ["إعادة تعبئة حساب", "يدويًا من طرف معتدل: الإجراء RESET_TOKENS في لوحة Alpha."],
    ],
    endpoints_title: "المسارات",
    request: "متن الطلب",
    response: "الجواب المرصود في الإنتاج",
    response2: "جواب التحديث",
    fields: "الحقول المنتظرة",
    field: "حقل",
    type: "نوع",
    required: "إجباري",
    comment: "ملاحظة",
    errors_title: "أجوبة الأخطاء",
    code: "الرمز",
    message: "الرسالة المُعادة",
    notes_title: "مما يُنفع معرفته",
    variant: "صيغة",
    alpha_title: "مسار الإدارة (محميّ)",
    alpha_body: "ليست واجهة عمومية: فهي تشغّل لوحة الإدارة. تشترط حسابًا دوراه founder أو moderator، ويُعاد قراءتهما في الخادم — والحساب العادي receives 403 Accès refusé مهما كانت الترويسة. الإجراءات المقبولة:",
    limits_title: "الحدود والنقاط الحساسة",
    limits: [
      "لا حدَّ لعدد الطلبات في الكود ولا فحص لحجم المتن: السقف الحقيقي هو حصة مزوّد الذكاء الاصطناعي.",
      "لا ترقيم للواجهة: المسار هو المسار. أي تغيير لاحق سيكسر عملاء الواجهة دون أي إخطار.",
      "مسارات الاستيراد لا تتحقق من الأنواع: تاريخ غير صالح يظهر كخطأ Postgres بكود 500 لا كـ 400 شارح.",
      "لا webhooks ولا بث تدريجي: الجواب يصل دفعة واحدة.",
      "لا يقرأ تلميذ بيانات تلميذ آخر: سياسات القاعدة هي auth.uid() = user_id. ومسارات الاستيراد تكتب دائمًا لحساب الرمز المُقدَّم، لا لـ user_id داخل المتن.",
    ],
    back: "العودة إلى الصفحة الأولى",
    status: "حالة الخدمة",
    privacy: "الخصوصية",
    copied: "تم النسخ!",
    copy: "نسخ",
    try_it: "أجوبة الردود لقطات، لا قوالب: أجوبة الذكاء تتغير، وهيئة JSON لا تتغير.",
    required_word: "نعم",
    optional_word: "لا",
  },
};

function CodeBlock({ id, title, text, copyState, onCopy, copiedLabel, copyLabel }: {
  id: string; title: string; text: string; copyState: string;
  onCopy: (text: string, id: string) => void; copiedLabel: string; copyLabel: string;
}) {
  return (      <div style={{ position: "relative", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.05)", borderTopLeftRadius: "14px", borderTopRightRadius: "14px", padding: "10px 20px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" as const }}>{title}</span>
          <button onClick={() => onCopy(text, id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
            {copyState === id ? <><Check size={14} style={{ color: "var(--ok)" }} /> {copiedLabel}</> : <><Copy size={14} /> {copyLabel}</>}
          </button>
        </div>
        <pre style={{ margin: 0, padding: "20px", background: "#0a0f1d", borderBottomLeftRadius: "14px", borderBottomRightRadius: "14px", overflowX: "auto", fontSize: "12.5px", lineHeight: 1.6, color: "#a5f3fc", fontFamily: "ui-monospace, monospace" }}>
          <code>{text}</code>
        </pre>
      </div>
  );
}

export default function ApiDocsPage() {
  const [lang, setLang] = useState("fr");
  const [copyState, setCopyState] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("site_lang");
    if (saved && saved in content) {
      setLang(saved);
      document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";
    }
    setOrigin(window.location.origin);
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
  const base = origin || "https://proappmoncef.netlify.app";
  const j = (o: unknown) => JSON.stringify(o, null, 2);

  const curl = useMemo(
    () =>
      `curl -X POST ${base}/api/chat \\\n` +
      `  -H "Authorization: Bearer VOTRE_JWT_SUPABASE" \\\n` +
      `  -H "Content-Type: application/json" \\\n` +
      `  -d '{ "messages": [ { "role": "user", "content": "Résume le cours de lumière, 5 puces." } ] }'`,
    [base]
  );

  const tokenCurl =
    `curl -X POST ${base.replace("https://proappmoncef.netlify.app", "https://ggnwtszeitrrfhedgipv.supabase.co")}/auth/v1/token?grant_type=password \\\n` +
    `  -H "apikey: ${"<cle_anonime>"}" \\\n` +
    `  -H "Content-Type: application/json" \\\n` +
    `  -d '{ "email": "ton@exemple.com", "password": "…" }'`;


  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen" style={{ background: "radial-gradient(circle at 10% 0%, rgba(0,210,182,0.12), transparent 45%), #050810", color: "#fff", minHeight: "100vh", padding: "24px clamp(16px, 5vw, 56px) 80px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <Link href="/" className="hover-white" style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "14px" }}>
            <ArrowLeft size={16} /> {t.back}
          </Link>
          <LanguageSwitcher currentLang={lang} onSwitch={switchLang} />
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(0,210,182,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Terminal size={26} color="var(--a)" />
            </div>
            <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", margin: 0, fontWeight: 900 }}>{t.title}</h1>
          </div>
          <p style={{ color: "var(--a)", fontWeight: 700, fontSize: "14px", margin: "0 0 12px" }}>{t.subtitle}</p>
          <p style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.75, maxWidth: "78ch", margin: "0 0 36px" }}>{t.intro}</p>
        </motion.div>

        {/* Base URL + auth */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "24px", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", margin: "0 0 14px", display: "flex", alignItems: "center", gap: "8px" }}><Key size={18} color="var(--a)" /> {t.auth_title}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginBottom: "18px" }}>
            <code style={{ background: "#0a0f1d", padding: "8px 14px", borderRadius: "10px", fontSize: "13px", color: "#a5f3fc" }}>{base}</code>
            <button onClick={() => handleCopy(base, "base")} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "12px", padding: "8px 12px" }}>
              {copyState === "base" ? t.copied : t.copy}
            </button>
            <span style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.45)" }}>{t.base_hint}</span>
          </div>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: "0 0 6px" }}>{t.auth_1}</p>
          <pre style={{ margin: "0 0 16px", padding: "12px 16px", background: "#0a0f1d", borderRadius: "10px", fontSize: "12.5px", color: "#a5f3fc", fontFamily: "ui-monospace, monospace", overflowX: "auto" }}>
            {`Authorization: Bearer <access_token>`}
          </pre>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: "0 0 6px" }}>{t.auth_2}</p>
          <pre style={{ margin: "0 0 16px", padding: "12px 16px", background: "#0a0f1d", borderRadius: "10px", fontSize: "12.5px", color: "#a5f3fc", fontFamily: "ui-monospace, monospace", overflowX: "auto" }}>
            {`{ "authToken": "<access_token>", "entries": [ … ] }`}
          </pre>
          <CodeBlock id="token" title={`curl — ${t.auth_3}`} text={tokenCurl} copyState={copyState} onCopy={handleCopy} copiedLabel={t.copied} copyLabel={t.copy} />
          <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.7 }}>{t.auth_note}</p>
        </div>

        {/* Crédits */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "24px", marginBottom: "40px" }}>
          <h2 style={{ fontSize: "18px", margin: "0 0 14px", display: "flex", alignItems: "center", gap: "8px" }}><Coins size={18} color="var(--a)" /> {t.credits_title}</h2>
          <div style={{ display: "grid", gap: "10px" }}>
            {t.credits.map(([k, v]) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(150px,1fr) 2.2fr", gap: "14px", fontSize: "13px", padding: "10px 14px", background: "rgba(0,0,0,0.25)", borderRadius: "10px" }}>
                <strong style={{ color: "#fff" }}>{k}</strong>
                <span style={{ color: "rgba(255,255,255,0.62)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <h2 style={{ fontSize: "22px", margin: "0 0 18px", fontWeight: 900 }}>{t.endpoints_title}</h2>

        {ROUTES.map((r, idx) => {
          const Icon = r.icon;
          return (
            <motion.div key={r.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "24px", marginBottom: "22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
                <Icon size={20} color="var(--a)" />
                <span style={{ background: r.method === "GET" ? "rgba(46,213,115,0.15)" : "rgba(0,210,182,0.15)", color: r.method === "GET" ? "#2ed573" : "var(--a)", fontWeight: 900, fontSize: "11px", padding: "4px 10px", borderRadius: "8px", letterSpacing: "0.08em" }}>{r.method}</span>
                <code style={{ fontSize: "15px", fontWeight: 800 }}>{r.path}</code>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{idx + 1} / {ROUTES.length + 1}</span>
              </div>

              {r.req ? <CodeBlock id={`${r.id}-req`} title={t.request} text={j(r.req)} copyState={copyState} onCopy={handleCopy} copiedLabel={t.copied} copyLabel={t.copy} /> : null}
              <CodeBlock id={`${r.id}-res`} title={`${t.response} — ${t.try_it}`} text={j(r.res)} copyState={copyState} onCopy={handleCopy} copiedLabel={t.copied} copyLabel={t.copy} />
              {r.res2 ? <CodeBlock id={`${r.id}-res2`} title={t.response2} text={j(r.res2)} copyState={copyState} onCopy={handleCopy} copiedLabel={t.copied} copyLabel={t.copy} /> : null}

              {r.variants?.map((v) => (
                <div key={v.label}>
                  <p style={{ fontSize: "12px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.4)", margin: "4px 0 6px" }}>{t.variant} — {v.label}</p>
                  <pre style={{ margin: "0 0 8px", padding: "12px 16px", background: "#0a0f1d", borderRadius: "10px", fontSize: "12px", color: "#fda4af", fontFamily: "ui-monospace, monospace", overflowX: "auto" }}>{j(v.body)}</pre>
                  <pre style={{ margin: "0 0 16px", padding: "12px 16px", background: "#0a0f1d", borderRadius: "10px", fontSize: "12px", color: "#a5f3fc", fontFamily: "ui-monospace, monospace", overflowX: "auto" }}>{j(v.res)}</pre>
                </div>
              ))}

              <h3 style={{ fontSize: "13px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.45)", margin: "20px 0 10px" }}>{t.fields}</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ textAlign: lang === "ar" ? "right" : "left", color: "rgba(255,255,255,0.4)" }}>
                      <th style={{ padding: "6px 10px", fontWeight: 700 }}>{t.field}</th>
                      <th style={{ padding: "6px 10px", fontWeight: 700 }}>{t.type}</th>
                      <th style={{ padding: "6px 10px", fontWeight: 700 }}>{t.required}</th>
                      <th style={{ padding: "6px 10px", fontWeight: 700 }}>{t.comment}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.fields.map((f) => (
                      <tr key={f[0]} style={{ borderTop: "1px solid rgba(255,255,255,0.07)", verticalAlign: "top" }}>
                        <td style={{ padding: "8px 10px", fontFamily: "ui-monospace, monospace", color: "#a5f3fc", whiteSpace: "nowrap" as const }}>{f[0]}</td>
                        <td style={{ padding: "8px 10px", color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" as const }}>{f[1]}</td>
                        <td style={{ padding: "8px 10px", color: f[2] === "oui" || f[2].startsWith("oui ") ? "var(--a)" : "rgba(255,255,255,0.35)" }}>{f[2]}</td>
                        <td style={{ padding: "8px 10px", color: "rgba(255,255,255,0.62)", lineHeight: 1.6 }}>{f[3]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: "13px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.45)", margin: "20px 0 10px" }}>{t.errors_title}</h3>
              <div style={{ display: "grid", gap: "6px" }}>
                {r.errors.map(([code, msg]) => (
                  <div key={code + msg} style={{ display: "flex", gap: "12px", alignItems: "baseline", fontSize: "12.5px", background: "rgba(0,0,0,0.25)", padding: "8px 12px", borderRadius: "8px" }}>
                    <code style={{ color: code[0] === "5" ? "#ff6b81" : code[0] === "4" ? "#ffa502" : "#2ed573", fontWeight: 800, minWidth: "34px" }}>{code}</code>
                    <span style={{ color: "rgba(255,255,255,0.65)", fontFamily: "ui-monospace, monospace", fontSize: "12px" }}>{msg}</span>
                  </div>
                ))}
              </div>

              {r.notes?.length ? (
                <>
                  <h3 style={{ fontSize: "13px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.45)", margin: "20px 0 10px" }}>{t.notes_title}</h3>
                  <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "6px", fontSize: "13px", color: "rgba(255,255,255,0.62)", lineHeight: 1.65 }}>
                    {r.notes.map((n) => <li key={n.slice(0, 30)}>{n}</li>)}
                  </ul>
                </>
              ) : null}
            </motion.div>
          );
        })}

        {/* Alpha */}
        <div style={{ background: "rgba(255,165,2,0.05)", border: "1px solid rgba(255,165,2,0.3)", borderRadius: "20px", padding: "24px", marginBottom: "40px" }}>
          <h2 style={{ fontSize: "18px", margin: "0 0 12px", display: "flex", alignItems: "center", gap: "8px" }}><Lock size={18} color="#ffa502" /> {t.alpha_title}</h2>
          <code style={{ fontSize: "14px", fontWeight: 800 }}>{`${ALPHA.method} ${ALPHA.path}`}</code>
          <p style={{ color: "rgba(255,255,255,0.62)", fontSize: "13px", lineHeight: 1.7, margin: "12px 0" }}>{t.alpha_body}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {ALPHA.actions.map((a) => (
              <code key={a} style={{ fontSize: "11.5px", background: "rgba(0,0,0,0.35)", padding: "6px 10px", borderRadius: "8px", color: "#ffd700" }}>{a}</code>
            ))}
          </div>
        </div>

        {/* Limites */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "24px", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "18px", margin: "0 0 14px", display: "flex", alignItems: "center", gap: "8px" }}><ShieldAlert size={18} color="var(--warn)" /> {t.limits_title}</h2>
          <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "10px", fontSize: "13px", color: "rgba(255,255,255,0.66)", lineHeight: 1.7 }}>
            {t.limits.map((l) => <li key={l.slice(0, 30)}>{l}</li>)}
          </ul>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "40px" }}>
          <Link href="/status" style={{ padding: "12px 20px", borderRadius: "12px", background: "rgba(0,210,182,0.12)", border: "1px solid var(--a)", color: "var(--a)", textDecoration: "none", fontWeight: 800, fontSize: "13px" }}>{t.status}</Link>
          <Link href="/privacy" style={{ padding: "12px 20px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 700, fontSize: "13px" }}>{t.privacy}</Link>
          <Link href="/api/health" style={{ padding: "12px 20px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 700, fontSize: "13px" }}>{"/api/health (JSON)"}</Link>
        </div>

        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.32)" }}>
          curl — <code style={{ color: "rgba(255,255,255,0.5)" }}>{"/api/chat"}</code>
          {"  "}
          <button onClick={() => handleCopy(curl, "c")} style={{ background: "none", border: "none", color: "var(--a)", cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}>{copyState === "c" ? t.copied : t.copy}</button>
        </p>
      </div>
    </div>
  );
}
