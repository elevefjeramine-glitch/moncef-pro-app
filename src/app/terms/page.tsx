"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ScrollText, Handshake, Coins, FileSignature, ShieldAlert, Trash2, PlugZap, Scale, Bot } from "lucide-react";
import dynamic from "next/dynamic";

const LanguageSwitcher = dynamic(() => import("@/components/LanguageSwitcher"), { ssr: false });

// Conditions révisées le 2026-08-28 : les crédits y deviennent chiffrés (ils
// sont mesurés), les pouvoirs de l'administration y sont écrits noir sur blanc
// (ils existent dans src/app/api/alpha/route.ts), et l'absence de garantie de
// disponibilité remplace le silence — la page /status ne promet plus non plus
// de pourcentage invérifiable.

const content = {
  fr: {
    title: "Conditions générales d'utilisation",
    subtitle: "Version du 28 août 2026. Elles décrivent le service tel qu'il fonctionne, pas tel qu'on aimerait qu'il fonctionne.",
    intro: "En créant un compte sur Moncef IA, tu acceptes ce qui suit. Le texte est court volontairement : une application scolaire de devoirs n'a pas besoin de vingt pages, mais elle a besoin d'être honnête sur trois points — ce que fait l'IA, ce que peut l'administrateur, et ce que personne ne garantit.",
    note: "Ce document décrit un logiciel. Ce n'est pas un avis juridique, et il ne remplace pas le règlement de ton établissement.",
    back: "Retour à l'accueil",
    sections: [
      { icon: "Handshake", title: "Acceptation et compte", body: [
        "Un compte = une adresse e-mail. Tu es responsable de ce qui se passe sous ton identifiant, y compris si tu prêtes ta session.",
        "Le service est gratuit. Aucun abonnement, aucun paiement, aucune donnée bancaire n'est demandée, donc aucune clause de remboursement n'existe : il n'y a rien à rembourser.",
        "Tu dois avoir l'âge requis par la réglementation de ton pays, ou l'accord d'un responsable légal.",
      ]},
      { icon: "Coins", title: "Crédits : les chiffres réels", body: [
        "Chaque appel à l'IA coûte 10 crédits. Un appel interrompu avant réponse du modèle n'est pas débité.",
        "Au premier appel d'une journée (date UTC), le solde est porté à 700 s'il est plus bas. Il n'est jamais réduit : un compte qui dispose de plus garde le surplus.",
        "Les rôles founder et moderator ne sont pas débités. Un modérateur peut recharger un compte manuellement depuis le panneau d'administration.",
        "Le contournement de ces limites — multiplicité de comptes pour multiplier les crédits, appels automatisés en rafale, revente d'accès — est un manquement, sanctionnable par la suspension du compte.",
      ]},
      { icon: "Bot", title: "Ce que l'IA fait, et ce qu'elle ne fait pas", body: [
        "Les réponses viennent d'un modèle de langage externe : Gemini de Google en principal, Groq en secours, choisis par le serveur. Le nom du modèle dans tes requêtes n'a aucun effet : il n'est pas lu.",
        "Un modèle de langage peut produire une réponse plausible et fausse. Rien ici ne vaut correction pédagogique : pour une date, une formule, une citation ou une démonstration, vérifie dans ton cours.",
        "L'analyse d'image (photo d'un énoncé) passe le fichier au modèle. La qualité dépend de la photo, du modèle, et n'est pas garantie.",
      ]},
      { icon: "FileSignature", title: "Ton contenu reste le tien", body: [
        "Tu déclares disposer des droits sur les documents que tu importes, et ne pas y mettre le travail d'autres personnes sans leur accord.",
        "Tu nous accordes la seule licence nécessaire au fonctionnement : stocker, afficher, transmettre au fournisseur de modèle, et supprimer quand tu le demandes. Pas de réutilisation commerciale, pas de publication de ton contenu par nous.",
        "En cas de retrait du service, tes devoirs et ton emploi du temps cessent d'exister avec ton compte : garde une copie de ce qui compte pour toi.",
      ]},
      { icon: "ShieldAlert", title: "Ce que l'administration peut faire", body: [
        "Le panneau Alpha permet à un fondateur et aux modérateurs de lister les comptes, de lire les devoirs et les statistiques, de modifier un compte, de recharger un solde et de supprimer un compte.",
        "C'est un pouvoir réel, pas une menace vague : il figure dans la documentation de l'API. Le panneau ne tient aucun journal des actions : si tu contestes une décision, c'est à la personne qui l'a prise qu'il faut la demander.",
        "Les messages de la messagerie interne sont visibles par leurs destinataires, et techniquement par l'administration. Ce n'est pas un canal pour échanger ce qu'on ne veut pas qu'un adulte de l'établissement puisse lire.",
      ]},
      { icon: "Trash2", title: "Fermer son compte", body: [
        "Réglages → « Compte et données » → « Demander la suppression ». La demande est annulable pendant 7 jours. Passé ce délai, la suppression est définitive et porte sur tout ce que le compte a produit.",
        "Une suppression demandée puis non annulée ne peut pas être interrompue rétroactivement après exécution. Recréer un compte avec la même adresse repart d'une base vide.",
      ]},
      { icon: "PlugZap", title: "Disponibilité et changements", body: [
        "Le service est fourni en l'état, sans engagement de disponibilité : pas de 99,9 % promis, parce que rien ne le mesure (la page d'état affiche des mesures en direct et rien d'autre).",
        "Les modèles, limites de crédits, fournisseurs et fonctionnalités peuvent changer sans préavis, y compris disparaître si un fournisseur payant se retire. La documentation de l'API est mise à jour en même temps que le code, pas avant.",
        "Des maintenances peuvent couper le site. Elles ne sont pas annoncées à l'avance ailleurs que dans l'application elle-même.",
      ]},
      { icon: "Scale", title: "Responsabilité", body: [
        "Nous ne garantissons ni la justesse des réponses, ni la continuité du service, ni la conservation des données au-delà de la suppression d'un compte.",
        "Nous ne pouvons être tenus responsables d'une conséquence scolaire (note, retard, travail perdu) liée à l'usage de l'application, ni d'une indisponibilité du fournisseur d'IA.",
        "Si un texte ici te paraît abusif, signale-le : une application scolaire n'a aucune raison de cacher ses clauses.",
      ]},
    ],
  },
  en: {
    title: "Terms of use",
    subtitle: "Version of 2026-08-28. They describe the service as it runs, not as we would like it to run.",
    intro: "Creating a Moncef IA account means you accept the following. The text is deliberately short: a school homework app doesn't need twenty pages, but it does need to be honest on three points — what the AI does, what the administrator can do, and what nobody guarantees.",
    note: "This document describes a piece of software. It is not legal advice, and it does not replace your school's rules.",
    back: "Back to home",
    sections: [
      { icon: "Handshake", title: "Acceptance and account", body: [
        "One account = one email address. You are responsible for what happens under your login, including if you share your session.",
        "The service is free. No subscription, no payment, no banking data is requested, so there is no refund clause: there is nothing to refund.",
        "You must be of the age required by your country's rules, or have a legal guardian's consent.",
      ]},
      { icon: "Coins", title: "Credits: the real numbers", body: [
        "Each AI call costs 10 credits. A call interrupted before the model answers is not charged.",
        "On the first call of a day (UTC date), the balance is raised to 700 if it is lower. It is never reduced: an account holding more keeps the surplus.",
        "founder and moderator roles are not charged. A moderator can top up an account manually from the admin panel.",
        "Circumventing these limits — many accounts to multiply credits, burst automated calls, reselling access — is a breach, punishable by suspension.",
      ]},
      { icon: "Bot", title: "What the AI does, and doesn't", body: [
        "Answers come from an external language model: Google's Gemini as primary, Groq as fallback, chosen by the server. A model name in your request has no effect: it isn't read.",
        "A language model can produce a plausible, wrong answer. Nothing here counts as pedagogical correction: for a date, a formula, a quote or a proof, check your notes.",
        "Image analysis (a photo of a question) passes the file to the model. Quality depends on the photo and the model, and is not guaranteed.",
      ]},
      { icon: "FileSignature", title: "Your content stays yours", body: [
        "You declare holding rights over what you import, and not placing other people's work there without their consent.",
        "You grant only the licence the service needs: store, display, send to the model provider, and delete when you ask. No commercial reuse, no publishing of your content by us.",
        "If the service goes away, your homework and timetable disappear with your account: keep a copy of what matters to you.",
      ]},
      { icon: "ShieldAlert", title: "What the administration can do", body: [
        "The Alpha panel lets a founder and moderators list accounts, read homework and statistics, edit an account, top up a balance and delete an account.",
        "That is a real power, not a vague threat: it is documented in the API reference, and nothing is logged about who did it — so contest a decision to the person who made it.",
        "Internal messages are visible to their recipients, and technically to the administration. This is not a channel for what you wouldn't want an adult at your school to read.",
      ]},
      { icon: "Trash2", title: "Closing your account", body: [
        "Settings → “Account and data” → “Request deletion”. A request stays cancellable for 7 days. After that, deletion is final and covers everything the account produced.",
        "A deletion that has run cannot be undone retroactively. Re-creating an account with the same address starts from an empty base.",
      ]},
      { icon: "PlugZap", title: "Availability and changes", body: [
        "The service is provided as-is, with no uptime commitment: no promised 99.9%, because nothing measures it (the status page shows live measurements and nothing else).",
        "Models, credit limits, providers and features may change without notice, including disappearing if a paid provider pulls out. The API documentation is updated alongside the code, not before.",
        "Maintenance can take the site down. It is announced nowhere else than in the application itself.",
      ]},
      { icon: "Scale", title: "Liability", body: [
        "We do not guarantee the correctness of answers, service continuity, or data retention beyond an account deletion.",
        "We cannot be held responsible for a school consequence (grade, lateness, lost work) from using the app, nor for an AI provider outage.",
        "If any clause here looks abusive, say so: a school app has no reason to hide its terms.",
      ]},
    ],
  },
  es: {
    title: "Condiciones de uso",
    subtitle: "Versión del 28 de agosto de 2026. Describen el servicio como funciona, no como nos gustaría que funcionara.",
    intro: "Crear una cuenta en Moncef IA significa que aceptas lo siguiente. El texto es corto a propósito: una aplicación escolar de deberes no necesita veinte páginas, pero sí ser honesta en tres puntos: qué hace la IA, qué puede el administrador y qué no garantiza nadie.",
    note: "Este documento describe un software. No es un asesoramiento jurídico y no sustituye el reglamento de tu centro.",
    back: "Volver al inicio",
    sections: [
      { icon: "Handshake", title: "Aceptación y cuenta", body: [
        "Una cuenta = un correo. Eres responsable de lo que ocurre con tu identificador, incluso si prestas tu sesión.",
        "El servicio es gratuito. No hay suscripción ni pago ni se piden datos bancarios, así que no existe cláusula de reembolso: no hay nada que devolver.",
        "Debes tener la edad que exige la normativa de tu país, o el consentimiento de un tutor legal.",
      ]},
      { icon: "Coins", title: "Créditos: las cifras reales", body: [
        "Cada llamada a la IA cuesta 10 créditos. Una llamada interrumpida antes de la respuesta no se descuenta.",
        "En la primera llamada de un día (fecha UTC) el saldo se eleva a 700 si era menor. Nunca se reduce: una cuenta con más conserva el excedente.",
        "Los roles founder y moderator no se descuentan. Un moderador puede recargar una cuenta a mano desde el panel.",
        "Sortear estos límites — multiplicar cuentas para multiplicar créditos, llamadas automatizadas en ráfaga, reventa de acceso — es una infracción sancionable con la suspensión.",
      ]},
      { icon: "Bot", title: "Lo que la IA hace y lo que no", body: [
        "Las respuestas vienen de un modelo externo: Gemini de Google como principal, Groq como respaldo, elegidos por el servidor. Un nombre de modelo en tu petición no tiene efecto: no se lee.",
        "Un modelo de lenguaje puede dar una respuesta verosímil y falsa. Nada de esto vale como corrección docente: para una fecha, una fórmula, una cita o una demostración, consulta tu apunte.",
        "El análisis de imagen (una foto del enunciado) pasa el archivo al modelo. La calidad depende de la foto y del modelo, y no está garantizada.",
      ]},
      { icon: "FileSignature", title: "Tu contenido sigue siendo tuyo", body: [
        "Declaras tener derechos sobre lo que importas y no meter allí el trabajo de otras personas sin su permiso.",
        "Nos concedes solo la licencia necesaria: almacenar, mostrar, enviar al proveedor del modelo y borrar cuando lo pidas. Sin reutilización comercial, sin publicar tu contenido.",
        "Si el servicio desaparece, tus deberes y tu horario desaparecen con tu cuenta: guarda copia de lo que te importa.",
      ]},
      { icon: "ShieldAlert", title: "Qué puede hacer la administración", body: [
        "El panel Alpha permite a un fundador y a los moderadores listar cuentas, leer deberes y estadísticas, modificar una cuenta, recargar un saldo y suprimir una cuenta.",
        "Es un poder real, no una amenaza vaga: está documentado en la referencia de la API y no se registra quién lo ejerció, así que reclama ante quien tomó la decisión.",
        "Los mensajes internos son visibles para sus destinatarios y, técnicamente, para la administración. No es un canal para lo que no quieras que lea un adulto del centro.",
      ]},
      { icon: "Trash2", title: "Cerrar la cuenta", body: [
        "Ajustes → «Cuenta y datos» → «Solicitar la eliminación». La solicitud es anulable durante 7 días. Después, la eliminación es definitiva y afecta a todo lo que la cuenta produjo.",
        "Una eliminación ya ejecutada no se deshace. Crear de nuevo una cuenta con el mismo correo empieza desde una base vacía.",
      ]},
      { icon: "PlugZap", title: "Disponibilidad y cambios", body: [
        "El servicio se presta tal cual, sin compromiso de disponibilidad: no prometemos un 99,9 % porque nada lo mide (la página de estado muestra mediciones en vivo y nada más).",
        "Modelos, límites de créditos, proveedores y funciones pueden cambiar sin aviso, incluso desaparecer si un proveedor de pago se retira. La documentación de la API se actualiza a la vez que el código, no antes.",
        "El mantenimiento puede tumbar el sitio. No se anuncia en ningún otro sitio que en la propia aplicación.",
      ]},
      { icon: "Scale", title: "Responsabilidad", body: [
        "No garantizamos la exactitud de las respuestas, la continuidad del servicio ni la conservación de datos más allá de la supresión de una cuenta.",
        "No podemos responder de una consecuencia escolar (nota, retraso, trabajo perdido) por usar la aplicación, ni de una caída del proveedor de IA.",
        "Si alguna cláusula te parece abusiva, dilo: una aplicación escolar no tiene razón para esconder sus condiciones.",
      ]},
    ],
  },
  ar: {
    title: "شروط الاستعمال",
    subtitle: "نسخة 28 غشت 2026. تصف الخدمة كما تعمل، لا كما نودّ أن تعمل.",
    intro: "إنشاء حساب في Moncef IA معناه قبولك لما يلي. النص قصير عن قصد: فتطبيق مدرسي للواجبات لا يحتاج عشرين صفحة، لكنه يحتاج إلى الصدق في ثلاث نقاط — ما يفعله الذكاء الاصطناعي، وما يستطيع المسيّر فعله، وما لا يضمنه أحد.",
    note: "هذه الوثيقة توصف برنامجًا. ليست استشارة قانونية، ولا تعوّض النظام الداخلي لمؤسستك.",
    back: "العودة إلى الصفحة الأولى",
    sections: [
      { icon: "Handshake", title: "القبول والحساب", body: [
        "حساب واحد = بريد إلكتروني واحد. أنت مسؤول عمّا يجري تحت هويتك، حتى لو أعارت جلستك لشخص آخر.",
        "الخدمة مجانية. لا اشتراك ولا أداء ولا طلب لمعطيات بنكية، لذا لا توجد بند استرجاع: لا شيء يُستَرَجَّع.",
        "يجب أن تبلغ السن التي يتطلبها نظام بلدك، أو أن تحصل على موافقة ولي الأمر.",
      ]},
      { icon: "Coins", title: "الرصيد: الأرقام الحقيقية", body: [
        "كل طلب من الذكاء الاصطناعي يكلّف 10 رصيد. والطلب الذي ينقطع قبل وصول الجواب لا يُخصم منه شيء.",
        "عند أول طلب في يوم (بتوقيت UTC) يُرفع الرصيد إلى 700 إن كان أقل. ولا يُنقَص أبدًا: من كان رصيده أعلى احتفظ بالزيادة.",
        "دورا founder و moderator لا يُخصمان. ويستطيع معتدل إعادة تعبئة حساب يدويًا من لوحة الإدارة.",
        "التحايل على هذه الحدود — تكثير الحسابات لتكثير الرصيد، أو الاستدعاءات الآلية المتتابعة، أو بيع الوصول — إخلال يُعاقَب عليه بتعليق الحساب.",
      ]},
      { icon: "Bot", title: "ما يفعله الذكاء الاصطناعي وما لا يفعله", body: [
        "الأجوبة تأتي من نموذج لغة خارجي: Gemini من Google أساسًا وGroq عند التعطل، والاختيار بيد الخادم. ذكر اسم نموذج في طلبك لا أثر له، فهو لا يُقرأ.",
        "قد يُنتج نموذج اللغة جوابًا مقنعًا وخاطئًا. لا شيء هنا يُغني عن التصحيح البيداغوجي: تحقق من درسك في تاريخ أو صيغة أو اقتباس أو براهين.",
        "تحليل الصورة (صورة نصّ التمرين) يسلّم الملف إلى النموذج؛ والجودة تعتمد على الصورة وعلى النموذج، وهي غير مضمونة.",
      ]},
      { icon: "FileSignature", title: "محتواك يبقى ملكك", body: [
        "تصرّح بأن لك حقوقًا على الوثائق التي تستوردها، وأنك لا تضع فيها عمل أشخاص آخرين دون موافقتهم.",
        "تمنحنا الترخيص الضروري لتشغيل الخدمة فقط: التخزين والعرض والإرسال إلى مزوّد النموذج والحذف عند طلبك. لا استعمال تجاري ولا نشر لمحتواك من جانبنا.",
        "إذا توقفت الخدمة، تختفي واجباتك وجدولك مع حسابك: احتفظ بنسخة مما يهمّك.",
      ]},
      { icon: "ShieldAlert", title: "ما يستطيع الإدارة فعله", body: [
        "لوحة Alpha تتيح لمؤسس وللمعتدلين عرض الحسابات، وقراءة الواجبات والإحصائيات، وتعديل حساب، وإعادة تعبئة رصيد، وحذف حساب.",
        "إنه سلطات فعلية لا تهديد غامض: وهي موثّقة في مرجع الواجهة البرمجية، ولا سجلّ يحدّد من استعملها، فاطلب التعليل ممن اتخذ القرار.",
        "رسائل المراسلة الداخلية مرئية لأصحابها، ومن الناحية التقنية للإدارة. فهي ليست قناة لما لا تريد أن يقرأه شخص راشد في مؤسستك.",
      ]},
      { icon: "Trash2", title: "إغلاق الحساب", body: [
        "الإعدادات ← «الحساب والبيانات» ← «طلب الحذف». الطلب قابل للإلغاء طوال 7 أيام. وبعد ذلك يكون الحذف نهائيًا ويشمل كل ما أنتجه الحساب.",
        "الحذف المنفَّذ لا يُراجَع فيه بأثر رجعي. وإنشاء حساب جديد بالبريد نفسه يبدأ من قاعدة فارغة.",
      ]},
      { icon: "PlugZap", title: "التوافر والتغييرات", body: [
        "الخدمة تُقدَّم كما هي، دون التزام بالتوافر: لا نَعِد بنسبة 99,9 ٪ لأن لا شيء يقيسها (صفحة الحالة تعرض قياسات حيّة فقط).",
        "النماذج وحدود الرصيد والمزوّدات والوظائف قد تتغير دون إشعار، وقد تزول إذا انسحب مزوّد مدفوع. ووثيقة الواجهة تُحدَّث مع الكود لا قبله.",
        "قد تُوقف الصيانة الموقع. ولا يُعلَن عنها في مكان آخر غير التطبيق نفسه.",
      ]},
      { icon: "Scale", title: "المسؤولية", body: [
        "لا نضمن صحة الأجوبة ولا استمرارية الخدمة ولا حفظ البيانات بعد حذف الحساب.",
        "لا نسأل عن نتيجة دراسية (نقطة، تأخر، عمل ضائع) بسبب استعمال التطبيق، ولا عن انقطاع مزوّد الذكاء.",
        "إذا بدا لك بند هنا تعسفيًا فأخبرنا: فلا سبب لتطبيق مدرسي أن يخفي شروطه.",
      ]},
    ],
  },
  zh: {
    title: "使用条款",
    subtitle: "2026-08-28 版本。条款描述服务实际运行方式，而不是我们希望它运行的方式。",
    intro: "在 Moncef IA 创建账户即表示你接受以下内容。文本刻意保持简短：一款学生作业应用不需要二十页条款，但必须在三点上诚实——AI 做了什么、管理员能做什么、以及没有人承诺了什么。",
    note: "本文件描述的是一个软件，不构成法律意见，也不能替代你所在学校的规章。",
    back: "返回首页",
    sections: [
      { icon: "Handshake", title: "接受与账户", body: [
        "一个账户对应一个邮箱。你的登录状态下发生的一切由你负责，包括把会话借给他人。",
        "服务免费。没有订阅、没有付款、不索要银行信息，因此也不存在退款条款：没有可退之物。",
        "你须达到所在法规定的年龄，或取得法定监护人的同意。",
      ]},
      { icon: "Coins", title: "额度：真实数字", body: [
        "每次调用 AI 消耗 10 个额度。模型未返回答案即中断的调用不扣费。",
        "每个 UTC 日的首次调用会把余额补足到 700（若低于此数）。余额更高时绝不削减。",
        "founder 与 moderator 不扣费。管理员可在后台面板手动为账户充值。",
        "绕过这些限制——多开账户以叠加额度、成批自动化调用、转售访问——属于违规，可被停用账户。",
      ]},
      { icon: "Bot", title: "AI 做什么、不做什么", body: [
        "回答来自外部语言模型：主用 Google 的 Gemini，故障时改用 Groq，由服务器选择。请求里写模型名没有任何作用：服务端不读取它。",
        "语言模型可能给出看似合理实则错误的回答。这里的内容都不具备教学批改效力：日期、公式、引文、证明请回查你的课堂笔记。",
        "图片分析（题干照片）会把文件交给模型处理。质量取决于照片与模型，不作保证。",
      ]},
      { icon: "FileSignature", title: "你的内容仍属于你", body: [
        "你声明对所导入的文档拥有相应权利，且未在未经同意的前提下放入他人成果。",
        "你授予我们的只是运行服务所必需的许可：存储、展示、发送给模型供应商，以及在你要求时删除。我们不作商业再利用，也不发布你的内容。",
        "若服务停止，你的作业与课程表会随账户一同消失：重要的东西请自行留档。",
      ]},
      { icon: "ShieldAlert", title: "管理方能做什么", body: [
        "Alpha 面板允许 founder 与 moderator 查看账户列表、读取作业与统计、修改账户、充值余额以及删除账户。",
        "这是实际存在的权限，不是模糊的威胁：它写在 API 文档里。面板不保存操作日志，因此若你对某项决定有异议，请向作出该决定的人索取理由。",
        "站内消息对收发双方可见，且在技术上对管理方可见。这不是用来交流“不希望学校里的大人看到”的内容的渠道。",
      ]},
      { icon: "Trash2", title: "注销账户", body: [
        "设置 → “账户与数据” → “申请删除”。申请在 7 天内可取消；逾期后删除即为最终状态，覆盖该账户产生的全部内容。",
        "已执行的删除不可追溯撤销。用同一邮箱重新注册将从空库开始。",
      ]},
      { icon: "PlugZap", title: "可用性与变更", body: [
        "服务按“现状”提供，没有可用性承诺：不承诺 99.9%，因为没有任何东西在测量它（状态页只显示实时测量值）。",
        "模型、额度上限、供应商与功能可能随时变更，付费供应商退出时相关能力也可能消失。API 文档随代码同步更新，而不会提前发布。",
        "维护可能导致站点不可用，除应用本身外不作其他渠道预告。",
      ]},
      { icon: "Scale", title: "责任", body: [
        "我们不保证回答的正确性、服务的连续性，也不保证在账户删除之外继续保存数据。",
        "对于因使用本应用造成的学业后果（成绩、迟到、作业丢失）以及 AI 供应商的中断，我们不承担责任。",
        "如果你觉得这里某一条款不合理，请直接提出：一款学生应用没有理由隐藏自己的条款。",
      ]},
    ],
  },
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

  const ICONS: Record<string, any> = { Handshake, Coins, Bot, FileSignature, ShieldAlert, Trash2, PlugZap, Scale };
  const c = content[lang as keyof typeof content] || content.fr;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} style={{ background: "radial-gradient(circle at 50% -10%, rgba(46,91,255,0.12), transparent 45%), #050810", color: "#fff", minHeight: "100vh", padding: "24px clamp(16px,5vw,56px) 80px" }}>
      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "14px" }}>
            <ArrowLeft size={16} /> {c.back}
          </Link>
          <LanguageSwitcher currentLang={lang} onSwitch={switchLang} />
        </div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(46,91,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ScrollText size={26} color="var(--a)" />
            </div>
            <h1 style={{ fontSize: "clamp(26px,5vw,38px)", margin: 0, fontWeight: 900 }}>{c.title}</h1>
          </div>
          <p style={{ color: "var(--a)", fontWeight: 700, fontSize: "13.5px", margin: "0 0 12px" }}>{c.subtitle}</p>
          <p style={{ color: "rgba(255,255,255,0.66)", lineHeight: 1.75, margin: "0 0 34px", maxWidth: "78ch" }}>{c.intro}</p>
        </motion.div>

        <div style={{ display: "grid", gap: "16px", marginBottom: "28px" }}>
          {c.sections.map((s, i) => {
            const Icon = ICONS[s.icon] ?? ScrollText;
            return (
              <div key={s.title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "22px" }}>
                <h2 style={{ fontSize: "16px", margin: "0 0 12px", display: "flex", alignItems: "center", gap: "10px", fontWeight: 800 }}>
                  <span style={{ width: "26px", height: "26px", borderRadius: "8px", background: "rgba(46,91,255,0.14)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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
          <Link href="/privacy" style={{ padding: "12px 20px", borderRadius: "12px", background: "rgba(0,210,182,0.12)", border: "1px solid var(--a)", color: "var(--a)", textDecoration: "none", fontWeight: 800, fontSize: "13px" }}>{"/privacy"}</Link>
          <Link href="/api-docs" style={{ padding: "12px 20px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 700, fontSize: "13px" }}>{"/api-docs"}</Link>
        </div>
      </div>
    </div>
  );
}
