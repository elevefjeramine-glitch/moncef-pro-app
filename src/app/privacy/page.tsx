"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Server, Eye, Database, Trash2, Users, Lock, Baby, MailQuestion } from "lucide-react";
import dynamic from "next/dynamic";

const LanguageSwitcher = dynamic(() => import("@/components/LanguageSwitcher"), { ssr: false });

// Les affirmations de cette page sont adossées à des mesures faites le
// 2026-08-28 sur le dépôt et sur l'infrastructure déployée :
//   - « aucun chiffrement au repos » : grep -rE "crypto|aes|encrypt" dans
//     src/app/api et src/app/comm -> aucune occurrence ;
//   - « aucun traceur » : aucun <script> tiers, aucun gtag/plausible/posthog
//     dans src/ ; seule la langue est gardée en localStorage ("site_lang") ;
//   - hégbergement : GET https://api.supabase.com/v1/projects/ggnwtszeitrrfhedgipv
//     -> region us-east-2 ; site servi par Netlify (proappmoncef.netlify.app) ;
//   - suppression : /api/account/delete + migration 0009 (delai de 7 jours).
// Là où une mesure n'existe pas, la page ne l'affirme pas.

type Section = { icon: string; title: string; body: string[] };

const ICONS: Record<string, any> = { Server, Eye, Database, Trash2, Users, Lock, Baby, MailQuestion };

const content = {
  fr: {
    title: "Politique de confidentialité",
    subtitle: "Version du 28 août 2026. Chaque affirmation ci-dessous correspond à l'état réel du service à cette date.",
    intro: "Cette page remplace un texte qui contenait des erreurs : il promettait un chiffrement de bout en bout que le service ne met pas en œuvre, et une réanalyse « locale » qui n'existe pas. Voici ce que la plateforme fait vraiment de tes données.",
    note: "Ce document décrit un logiciel. Ce n'est pas un avis juridique : si le service s'ouvre à d'autres établissements ou devient payant, fais-le relire.",
    back: "Retour à l'accueil",
    sections: [
      {
        icon: "Eye",
        title: "Ce que nous conservons",
        body: [
          "À l'inscription : ton adresse e-mail, ton prénom et ton nom (reprise du compte Google ou Microsoft si tu passes par là), un rôle (normal, moderator ou founder), un solde de crédits, ta couleur de thème et ta langue.",
          "Ce que tu crées dans l'application : devoirs (matière, consigne, professeur, priorité, statut, avancement, échéance), lignes d'emploi du temps (semaine A/B, jour, matière, horaire), événements (titre, description, date, heure, catégorie) et messages de la messagerie interne.",
          "Horodatage de création du compte. C'est tout : l'application n'enregistre pas de journal de requêtes, ne prend pas d'empreinte de navigateur et ne conserve pas de brouillons côté serveur.",
        ],
      },
      {
        icon: "Server",
        title: "Où sont les données",
        body: [
          "La base de données est un projet Supabase hébergé dans la région us-east-2, c'est-à-dire aux États-Unis (Ohio). Elle n'est pas en Europe.",
          "Les pages du site sont servies par Netlify, depuis son réseau de distribution mondial.",
          "Conséquence pratique pour le RGPD : un transfert vers un pays hors Union européenne. Nous ne disposons pas de clauses types ni de certificat d'adéquation propre : la base légale repose sur l'usage du service par son utilisateur, et la localisation européenne reste possible en migrant le projet.",
        ],
      },
      {
        icon: "Lock",
        title: "Chiffrement : ce qui est vrai",
        body: [
          "Le trajet entre ton navigateur et nos serveurs est chiffré en HTTPS (TLS). C'est le cas de toutes les requêtes, y compris l'API.",
          "Ce n'est PAS un chiffrement de bout en bout. Les données sont lisibles en clair dans la base par l'exploitant du service et, techniquement, par Supabase en tant qu'hébergeur. Aucun chiffrement supplémentaire au repos n'est activé, et il n'existe pas de clé que nous ne pourrions pas lire.",
          "Les mots de passe, eux, ne sont jamais stockés en clair : ils sont hachés par le service d'authentification.",
        ],
      },
      {
        icon: "Users",
        title: "L'IA voit ce que tu lui envoies",
        body: [
          "Chaque conversation est transmise à un modèle de langage externe : Gemini de Google en principal, Groq en secours. Les réponses ne sont pas produites dans ton navigateur, ni sur notre serveur.",
          "Nous ne revendons pas ces données et nous n'entraînons pas nos propres modèles dessus. En revanche, le traitement obéit aux conditions du fournisseur concerné, que nous ne contrôlons pas.",
          "Ne colle pas dans la zone de discussion une information que tu ne voudrais pas confier à ces deux entreprises.",
        ],
      },
      {
        icon: "Database",
        title: "Ce que nous ne faisons pas",
        body: [
          "Aucun cookie publicitaire, aucun traceur, aucun script tiers chargé dans la page : la seule chose mémorisée dans ton navigateur est la langue du site, dans le stockage local.",
          "Aucun paiement : le service est gratuit, nous ne manipulons ni carte bancaire ni coordonnées postales.",
          "Aucune revente de données, aucun démarchage par e-mail, aucune newsletter.",
        ],
      },
      {
        icon: "Trash2",
        title: "Supprimer ses données",
        body: [
          "Réglages → onglet « Compte et données » → « Demander la suppression ». Une demande en cours reste annulable pendant 7 jours, d'un clic, au même endroit.",
          "À l'échéance, la suppression porte sur le profil, les devoirs, l'emploi du temps, les événements, les messages envoyés et reçus, les conversations créées, les sessions ouvertes, les identités Google ou Microsoft et les facteurs d'authentification à deux facteurs.",
          "Quand elle est exécutée : au premier appel que ton compte déclenche après l'échéance, ou sur demande par un modérateur, qui traite alors toute la file d'attente. Il n'y a pas de cron dans l'infrastructure qui tournerait pendant que tu ne viens pas.",
          "Avant de demander, tu peux exporter toi-même ce qui t'intéresse : les pages Devoirs et Emploi du temps sont consultables et copiables. Une suppression exécutée n'est pas réversible ; recréer un compte avec la même adresse ne retrouve rien.",
        ],
      },
      {
        icon: "Baby",
        title: "Comptes d'élèves mineurs",
        body: [
          "Le service est pensé pour des élèves, donc souvent mineurs. Un compte est relié à une adresse e-mail : l'usage attendu est celui d'une adresse que l'élève consulte lui-même et, selon le règlement applicable, avec l'accord d'un responsable légal.",
          "Un modérateur ou le fondateur peut lire la liste des comptes et leurs métadonnées via le panneau d'administration, ainsi que supprimer un compte : ce n'est pas caché, c'est l'objet de ce panneau.",
        ],
      },
      {
        icon: "MailQuestion",
        title: "Nous écrire, et tes droits",
        body: [
          "Pour un accès à tes données, une rectification, une opposition ou une réclamation : passe par le canal de l'établissement, ou signale-le dans l'application à un modérateur. Aucune adresse e-mail publique n'est affichée sur ce site, volontairement, pour ne pas exposer celle de l'exploitant au ramassage automatique.",
          "Tu peux obtenir la copie de tes données sans passer par nous : la messagerie, les devoirs et l'emploi du temps t'appartiennent et s'affichent dans ton compte.",
          "Si une réponse ne vient pas, une réclamation peut être déposée auprès de l'autorité de protection des données de ton pays.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy policy",
    subtitle: "Version of 2026-08-28. Every statement below matches the actual state of the service on that date.",
    intro: "This page replaces a text that was wrong: it promised end-to-end encryption the service does not implement, and “local” re-analysis that does not exist. Here is what the platform really does with your data.",
    note: "This document describes a piece of software. It is not legal advice: if the service opens to other schools or becomes paid, have it reviewed.",
    back: "Back to home",
    sections: [
      { icon: "Eye", title: "What we keep", body: [
        "At sign-up: your email address, first and last name (taken from your Google or Microsoft account if you use one), a role (normal, moderator or founder), a credit balance, your theme colour and your language.",
        "What you create in the app: homework (subject, task, teacher, priority, status, progress, due date), timetable rows (week A/B, day, subject, time slot), events (title, description, date, time, category) and internal messages.",
        "The account creation timestamp. That is all: the app keeps no request log, takes no browser fingerprint and stores no drafts server-side.",
      ]},
      { icon: "Server", title: "Where the data lives", body: [
        "The database is a Supabase project hosted in region us-east-2 — the United States (Ohio). It is not in Europe.",
        "The site itself is served by Netlify, from its global CDN.",
        "GDPR consequence: a transfer to a country outside the European Union. We hold no standard contractual clauses of our own; the lawful basis rests on the user's use of the service, and moving the project to an EU region remains possible.",
      ]},
      { icon: "Lock", title: "Encryption: what is true", body: [
        "The path between your browser and our servers is encrypted with HTTPS (TLS). That covers every request, including the API.",
        "It is NOT end-to-end encryption. Data is readable in the database by the service operator and, technically, by Supabase as host. No extra at-rest encryption is enabled, and there is no key we could not read.",
        "Passwords themselves are never stored in clear text: they are hashed by the authentication service.",
      ]},
      { icon: "Users", title: "The AI sees what you send it", body: [
        "Each conversation is sent to an external language model: Google's Gemini as primary, Groq as fallback. Answers are not produced in your browser, nor on our server.",
        "We do not resell this data and do not train our own models on it. Processing nonetheless follows the terms of whichever provider is used, which we do not control.",
        "Do not paste into the chat anything you would not trust to those two companies.",
      ]},
      { icon: "Database", title: "What we do not do", body: [
        "No advertising cookies, no trackers, no third-party script loaded in the page: the only thing remembered in your browser is the site language, in local storage.",
        "No payments: the service is free, we handle no card data and no postal address.",
        "No data resale, no email marketing, no newsletter.",
      ]},
      { icon: "Trash2", title: "Deleting your data", body: [
        "Settings → “Account and data” tab → “Request deletion”. A pending request stays cancellable for 7 days, in one click, in the same place.",
        "At the deadline, deletion covers the profile, homework, timetable, events, messages sent and received, conversations created, open sessions, Google or Microsoft identities and two-factor factors.",
        "When it runs: on the first call your account makes after the deadline, or on demand by a moderator, who then processes the whole queue. There is no cron in the infrastructure running while you are away.",
        "Before requesting, export whatever matters to you: the Homework and Timetable pages are readable and copyable. A finished deletion is not reversible; re-creating an account with the same address recovers nothing.",
      ]},
      { icon: "Baby", title: "Accounts of underage students", body: [
        "The service is built for students, so often minors. An account is tied to an email address: the expected use is one the student reads themselves and, under applicable rules, with a legal guardian's consent.",
        "A moderator or the founder can read the list of accounts and their metadata through the admin panel, and can delete an account: that is not hidden, it is what that panel is for.",
      ]},
      { icon: "MailQuestion", title: "Contact and your rights", body: [
        "For access, rectification, objection or a complaint: go through your school's channel, or report it in the app to a moderator. No public email address is shown on this site, deliberately, so the operator's address isn't exposed to automated harvesting.",
        "You can obtain a copy of your data without asking us: messages, homework and timetable belong to you and are displayed in your account.",
        "If no answer comes, you may complain to the data protection authority of your country.",
      ]},
    ],
  },
  es: {
    title: "Política de privacidad",
    subtitle: "Versión del 28 de agosto de 2026. Cada afirmación de abajo corresponde al estado real del servicio en esa fecha.",
    intro: "Esta página sustituye a un texto que era falso: prometía un cifrado de extremo a extremo que el servicio no aplica, y un reanálisis «local» que no existe. Esto es lo que la plataforma hace realmente con tus datos.",
    note: "Este documento describe un software. No es un asesoramiento jurídico: si el servicio se abre a otros centros o se vuelve de pago, hazlo revisar.",
    back: "Volver al inicio",
    sections: [
      { icon: "Eye", title: "Qué guardamos", body: [
        "Al registrarse: tu correo, tu nombre y apellido (tomados de tu cuenta Google o Microsoft si usas una), un rol (normal, moderator o founder), un saldo de créditos, tu color de tema y tu idioma.",
        "Lo que creas en la aplicación: deberes (asignatura, consigna, profesor, prioridad, estado, progreso, fecha), líneas del horario (semana A/B, día, asignatura, hora), eventos (título, descripción, fecha, hora, categoría) y mensajes de la mensajería interna.",
        "La marca de tiempo de creación. Nada más: la aplicación no guarda registro de peticiones, no toma huella del navegador y no conserva borradores en el servidor.",
      ]},
      { icon: "Server", title: "Dónde están los datos", body: [
        "La base de datos es un proyecto de Supabase alojado en la región us-east-2, es decir en Estados Unidos (Ohio). No está en Europa.",
        "Las páginas del sitio las sirve Netlify, desde su red de distribución mundial.",
        "Consecuencia práctica para el RGPD: una transferencia a un país fuera de la Unión Europea. No disponemos de cláusulas contractuales tipo propias; la base legal se apoya en el uso del servicio por parte del usuario, y migrar el proyecto a una región europea sigue siendo posible.",
      ]},
      { icon: "Lock", title: "Cifrado: lo que es cierto", body: [
        "El trayecto entre tu navegador y nuestros servidores va cifrado con HTTPS (TLS). Es el caso de todas las peticiones, incluida la API.",
        "No es un cifrado de extremo a extremo. Los datos son legibles en la base por quien opera el servicio y, técnicamente, por Supabase como anfitrión. No hay cifrado adicional en reposo y no existe ninguna clave que no pudiéramos leer.",
        "Las contraseñas, en cambio, nunca se guardan en claro: se almacenan como hash en el servicio de autenticación.",
      ]},
      { icon: "Users", title: "La IA ve lo que le envías", body: [
        "Cada conversación se envía a un modelo de lenguaje externo: Gemini de Google como principal, Groq como respaldo. Las respuestas no se producen en tu navegador ni en nuestro servidor.",
        "No revendemos esos datos ni entrenamos modelos propios con ellos. El tratamiento obedece, eso sí, a las condiciones del proveedor usado, que no controlamos.",
        "No pegues en el chat nada que no quisieras confiar a esas dos empresas.",
      ]},
      { icon: "Database", title: "Lo que no hacemos", body: [
        "Sin cookies publicitarias, sin rastreadores, sin scripts de terceros en la página: lo único que se recuerda en tu navegador es el idioma del sitio, en el almacenamiento local.",
        "Sin pagos: el servicio es gratuito, no manipulamos tarjetas ni direcciones postales.",
        "Sin reventa de datos, sin correo comercial, sin boletines.",
      ]},
      { icon: "Trash2", title: "Borrar tus datos", body: [
        "Ajustes → pestaña «Cuenta y datos» → «Solicitar la eliminación». Una solicitud en curso se puede anular durante 7 días, con un clic, en el mismo sitio.",
        "Al vencer el plazo, la eliminación afecta al perfil, los deberes, el horario, los eventos, los mensajes enviados y recibidos, las conversaciones creadas, las sesiones abiertas, las identidades Google o Microsoft y los factores de verificación en dos pasos.",
        "Cuándo se ejecuta: en la primera llamada que haga tu cuenta tras el plazo, o a petición de un moderador, que entonces procesa toda la cola. No existe ningún cron en la infraestructura que trabaje mientras no vienes.",
        "Antes de solicitarla, exporta lo que te interese: las páginas Deberes y Horario se pueden leer y copiar. Una eliminación ejecutada no es reversible; crear de nuevo una cuenta con la misma dirección no recupera nada.",
      ]},
      { icon: "Baby", title: "Cuentas de alumnos menores", body: [
        "El servicio está pensado para alumnos, a menudo menores de edad. Una cuenta va ligada a un correo: el uso previsto es una dirección que el propio alumno consulta y, según la norma aplicable, con el consentimiento de un tutor legal.",
        "Un moderador o el fundador pueden leer la lista de cuentas y sus metadatos desde el panel de administración, y suprimir una cuenta: no está oculto, es la función de ese panel.",
      ]},
      { icon: "MailQuestion", title: "Escribirnos y tus derechos", body: [
        "Para acceso, rectificación, oposición o reclamación: usa el canal del centro o coméntalo en la aplicación con un moderador. No se muestra ningún correo público en este sitio, a propósito, para no exponer la dirección del operador a la recolección automática.",
        "Puedes obtener una copia de tus datos sin pedirnos nada: mensajes, deberes y horario son tuyos y se muestran en tu cuenta.",
        "Si no llega respuesta, puedes reclamar ante la autoridad de protección de datos de tu país.",
      ]},
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    subtitle: "نسخة 28 غشت 2026. كل عبارة أدناه تقابل الوضع الحقيقي للخدمة في ذلك التاريخ.",
    intro: "تحل هذه الصفحة محل نص كان خاطئًا: كان يَعِد بتشفير من الطرف إلى الطرف لا تطبقه الخدمة، وبإعادة تحليل «محلية» غير موجودة. هذا ما تفعله المنصة فعلًا ببياناتك.",
    note: "هذا الوثيقة توصف برنامجًا، وليست استشارة قانونية: إذا فُتحت الخدمة على مؤسسات أخرى أو صارت مدفوعة، يُستحسن إعادة قراءتها من طرف مختص.",
    back: "العودة إلى الصفحة الأولى",
    sections: [
      { icon: "Eye", title: "ما نحفظه", body: [
        "عند الإنشاء: بريدك الإلكتروني، اسمك ولقبك (مأخوذان من حسابك في Google أو Microsoft إن استعملت واحدًا)، دورك (normal أو moderator أو founder)، رصيدك، لون الواجهة ولغتك.",
        "ما تنشئه داخل التطبيق: الواجبات (المادة، التمرين، الأستاذ، الأهمية، الحالة، التقدم، الأجل)، أسطر جدول الحصص (الأسبوع أ/ب، اليوم، المادة، التوقيت)، الأحداث (العنوان، الوصف، التاريخ، الساعة، التصنيف) ورسائل المراسلة الداخلية.",
        "تاريخ إنشاء الحساب. هذا كل شيء: التطبيق لا يخزن سجل الطلبات، ولا يبصمة للمتصفح، ولا يحفظ مسودات في الخادم.",
      ]},
      { icon: "Server", title: "أين توجد البيانات", body: [
        "قاعدة البيانات مشروع Supabase مستضاف في المنطقة us-east-2، أي في الولايات المتحدة (أوهايو). فهي ليست في أوروبا.",
        "أما صفحات الموقع فيقدّمها Netlify عبر شبكة توزيعه العالمية.",
        "النتيجة العملية بالنسبة لنظام حماية البيانات العام: تحويل إلى بلد خارج الاتحاد الأوروبي. لا نملك بنودًا تعاقدية نموذجية خاصة بنا، ويستند السند القانوني إلى استعمال الخدمة من طرف المستخدم، مع بقاء إمكانية نقل المشروع إلى منطقة أوروبية.",
      ]},
      { icon: "Lock", title: "التشفير: ما هو صحيح", body: [
        "الطريق بين متصفحك وخوادمنا مشفّر بـ HTTPS (TLS). وهذا ينطبق على كل الطلبات، بما فيها الواجهة البرمجية.",
        "لكنه ليس تشفيرًا من الطرف إلى الطرف. البيانات مقروءة في القاعدة من طرف مشغّل الخدمة، ومن الناحية التقنية من طرف Supabase كمستضيف. لا يوجد تشفير إضافي في الوضع الساكن، ولا مفتاح عجزنا عن قراءته.",
        "أما كلمات السر فلا تُخزَّن أبدًا نصًا صريحًا: إنها مُجزَّأة (hash) في خدمة المصادقة.",
      ]},
      { icon: "Users", title: "الذكاء الاصطناعي يرى ما ترسله", body: [
        "كل محادثة تُرسَل إلى نموذج لغة خارجي: Gemini من Google أساسًا، وGroq عند التعطل. الأجوبة لا تُنتَج في متصفحك ولا على خادمنا.",
        "لا نبيع هذه البيانات ولا ندرّب بها نماذجنا الخاصة. لكن معالجتها تخضع لشروط المزوّد المعني، وهو ما لا نتحكم فيه.",
        "لا تلصق في فضاء المحادثة ما لا تودّ ائتمان هاتين الشركتين عليه.",
      ]},
      { icon: "Database", title: "ما لا نفعله", body: [
        "لا كوكيز إشهارية، ولا متتبعات، ولا برمجيات أطراف ثالثة في الصفحة: الشيء الوحيد المحفوظ في متصفحك هو لغة الموقع في التخزين المحلي.",
        "لا أداء: الخدمة مجانية، ولا نتعامل مع بطائق بنكية ولا مع عناوين بريدية.",
        "لا إعادة بيع للبيانات، ولا دعاية عبر البريد، ولا نشرات إخبارية.",
      ]},
      { icon: "Trash2", title: "حذف بياناتك", body: [
        "الإعدادات ← تبويب «الحساب والبيانات» ← «طلب الحذف». الطلب الجاري يبقى قابلاً للإلغاء طوال 7 أيام بنقرة واحدة في المكان نفسه.",
        "عند انقضاء الأجل يشمل الحذف: الملف الشخصي، الواجبات، جدول الحصص، الأحداث، الرسائل المرسلة والمستقبلة، المحادثات التي أنشأتها، الجلسات المفتوحة، هويات Google أو Microsoft وعوامل التحقق بخطوتين.",
        "متى يُنفَّذ؟ عند أول طلب يُصدره حسابك بعد الأجل، أو بطلب من معتدل يعالج حينها قائمة الانتظار كلها. لا يوجد أي cron في البنية يعمل وأنت غائب.",
        "قبل الطلب، صدّر بنفسك ما يهمّك: صفحتا الواجبات وجدول الحصص قابلتان للقراءة والنسخ. والحذف المنفَّذ لا يُتراجَع فيه؛ وإنشاء حساب جديد بنفس البريد لا يسترجع شيئًا.",
      ]},
      { icon: "Baby", title: "حسابات التلاميذ القاصرين", body: [
        "الخدمة موجّهة للتلاميذ، وكثير منهم قاصرون. الحساب مربوط ببريد إلكتروني، والاستعمال المرتقب عنوان يراجعه التلميذ بنفسه و، بحسب النظام الجاري، بموافقة ولي الأمر.",
        "يستطيع معتدل أو المؤسس قراءة قائمة الحسابات وبياناتها عبر لوحة الإدارة، كما يستطيع حذف حساب: وهذا ليس خفيًا، بل هو غرض تلك اللوحة.",
      ]},
      { icon: "MailQuestion", title: "التواصل وحقوقك", body: [
        "للوصول إلى بياناتك أو تصحيحها أو الاعتراض عليها أو تقديم شكوى: مرّ عبر قناة المؤسسة أو بلّغ داخل التطبيق إلى معتدل. لا نعرض أي بريد إلكتروني عمومي في هذا الموقع، بصفة مقصودة، حتى لا يقع بريد المشغّل في الجمع الآلي للعناوين.",
        "يمكنك الحصول على نسخة من بياناتك دون سؤالنا: الرسائل والواجبات وجدول الحصص ملكك وتُعرض في حسابك.",
        "إن لم تصلك إجابة، يمكنك التظلم لدى سلطة حماية البيانات في بلدك.",
      ]},
    ],
  },
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

  const c = content[lang as keyof typeof content] || content.fr;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ background: "radial-gradient(circle at 50% -10%, rgba(0,210,182,0.1), transparent 45%), #050810", color: "#fff", minHeight: "100vh", padding: "24px clamp(16px,5vw,56px) 80px" }}>
      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "14px" }}>
            <ArrowLeft size={16} /> {c.back}
          </Link>
          <LanguageSwitcher currentLang={lang} onSwitch={switchLang} />
        </div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(0,210,182,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={26} color="var(--a)" />
            </div>
            <h1 style={{ fontSize: "clamp(26px,5vw,38px)", margin: 0, fontWeight: 900 }}>{c.title}</h1>
          </div>
          <p style={{ color: "var(--a)", fontWeight: 700, fontSize: "13.5px", margin: "0 0 12px" }}>{c.subtitle}</p>
          <p style={{ color: "rgba(255,255,255,0.66)", lineHeight: 1.75, margin: "0 0 34px", maxWidth: "78ch" }}>{c.intro}</p>
        </motion.div>

        <div style={{ display: "grid", gap: "16px", marginBottom: "28px" }}>
          {c.sections.map((s, i) => {
            const Icon = ICONS[s.icon] ?? ShieldCheck;
            return (
              <div key={s.title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "22px" }}>
                <h2 style={{ fontSize: "16px", margin: "0 0 12px", display: "flex", alignItems: "center", gap: "10px", fontWeight: 800 }}>
                  <span style={{ width: "26px", height: "26px", borderRadius: "8px", background: "rgba(0,210,182,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={15} color="var(--a)" />
                  </span>
                  {i + 1}. {s.title}
                </h2>
                <div style={{ display: "grid", gap: "10px" }}>
                  {s.body.map((p) => (
                    <p key={p.slice(0, 30)} style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.75, color: "rgba(255,255,255,0.66)" }}>{p}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.38)", lineHeight: 1.7, marginBottom: "26px" }}>{c.note}</p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/terms" style={{ padding: "12px 20px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 700, fontSize: "13px" }}>{"/terms"}</Link>
          <Link href="/status" style={{ padding: "12px 20px", borderRadius: "12px", background: "rgba(0,210,182,0.12)", border: "1px solid var(--a)", color: "var(--a)", textDecoration: "none", fontWeight: 800, fontSize: "13px" }}>{"/status"}</Link>
        </div>
      </div>
    </div>
  );
}
