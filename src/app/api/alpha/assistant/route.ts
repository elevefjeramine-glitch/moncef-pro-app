import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CorpsTropVolumineux, LIMITE_CORPS, lireJson, reponse413, rejeterSiAnnonceTropGrosse } from "@/lib/corps";
// Six tentatives au pire (2 fournisseurs × 2 canaux) avec un timeout court chacune :
// sans budget explicite, Netlify coupe la fonction à son défaut de 10 s et l'élève
// ne voit jamais le message « aucune action exécutée ».
export const maxDuration = 60;


/**
 * ALPHA — l'assistant qui APPUIE sur les boutons.
 *
 * Avant ce fichier, la console du panneau admin ne pouvait que décrire les
 * gestes à faire : son prompt disait « tu peux expliquer comment changer un
 * rôle ». Un admin qui écrit « passe Amina en modératrice » repartait avec un
 * mode d'emploi. Ici, le même appel renvoie une fonction que le serveur exécute
 * lui-même, avec la session du fondateur, puis relit la base pour rendre
 * compte. Trois règles :
 *
 *  1. le modèle ne touche jamais la base : il demande, le serveur fait ;
 *  2. ce qui est irreversible (supprimer un compte) n'est JAMAIS exécuté ici —
 *     la route renvoie une proposition que l'interface doit confirmer ;
 *  3. chaque action renvoyée porte la VALEUR RELUE en base, pas ce que le
 *     modèle a cru avoir écrit.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const GEMINI = process.env.GEMINI_API_KEY ?? "";

const ROLES = ["normal", "moderator", "founder"] as const;
type Role = (typeof ROLES)[number];

function admin() {
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

const OUTILS = [
  {
    name: "changer_role",
    description:
      "Change réellement le rôle d'un utilisateur de la plateforme. `cible` = e-mail (ou début d'e-mail, ou identifiant). Rôles possibles : normal, moderator, founder.",
    parameters: {
      type: "object",
      properties: {
        cible: { type: "string", description: "E-mail ou identifiant de la personne visée" },
        role: { type: "string", enum: ROLES as unknown as string[], description: "Nouveau rôle" },
      },
      required: ["cible", "role"],
    },
  },
  {
    name: "donner_credits",
    description: "Fixe le solde de crédits d'un utilisateur à `credits` (entier, 0 à 100000).",
    parameters: {
      type: "object",
      properties: {
        cible: { type: "string" },
        credits: { type: "integer", description: "Nouveau solde, pas un delta" },
      },
      required: ["cible", "credits"],
    },
  },
  {
    name: "lister_utilisateurs",
    description: "Liste les comptes (e-mail, rôle, crédits). `filtre` optionnel : sous-chaîne d'e-mail ou de nom.",
    parameters: {
      type: "object",
      properties: { filtre: { type: "string" } },
    },
  },
  {
    name: "statistiques",
    description: "Compte exact : utilisateurs, devoirs, messages, cours d'emploi du temps.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "proposer_suppression",
    description:
      "NE SUPPRIME RIEN. Prépare une demande de suppression de compte que l'interface administrative affichera et que l'humain devra confirmer. À utiliser dès que l'utilisateur demande de supprimer un compte.",
    parameters: {
      type: "object",
      properties: { cible: { type: "string" } },
      required: ["cible"],
    },
  },
];

const CHARTE =
  "Tu es ALPHA, l'assistant d'administration de la plateforme Moncef IA. " +
  "Règles : (1) tu n'inventes aucune donnée — tout chiffre que tu avances vient d'un appel à tes fonctions ; " +
  "(2) pour modifier quoi que ce soit, tu APPELLES la fonction correspondante, tu ne décris pas la marche à suivre ; " +
  "(3) si la demande est ambiguë (plusieurs personnes correspondent), tu demandes laquelle au lieu de choisir ; " +
  "(4) une suppression ne s'exécute jamais ici : tu appelles proposer_suppression et tu préviens que l'humain doit confirmer ; " +
  "(5) tu réponds en français, sobrement, après avoir lu les résultats d'appels.";

/** E-mail, nom, ou identifiant → une ligne de `public.users`, ou une liste si ambigu. */
async function trouver(db: ReturnType<typeof admin>, cible: string) {
  const brut = String(cible ?? "").trim();
  if (!brut) return { rows: [] as any[], motif: "cible vide" };
  if (/^[0-9a-f-]{36}$/i.test(brut)) {
    const { data } = await db.from("users").select("id, email, first_name, last_name, role, tokens").eq("id", brut).limit(3);
    return { rows: data ?? [] };
  }
  const echappe = brut.replace(/[%_\\]/g, (c) => "\\" + c);
  const { data } = await db
    .from("users")
    .select("id, email, first_name, last_name, role, tokens")
    .or(`email.ilike.%${echappe}%,first_name.ilike.${echappe},last_name.ilike.${echappe}`)
    .limit(4);
  return { rows: data ?? [], motif: (data ?? []).length ? undefined : "aucun compte ne correspond" };
}

export async function POST(req: Request) {
  const refus = rejeterSiAnnonceTropGrosse(req, LIMITE_CORPS.alpha);
  if (refus) return refus;
  try {
    type Message = { role: string; content: string };
    const corps = (await lireJson(req, LIMITE_CORPS.alpha)) as { messages?: unknown; authToken?: string };
    const messages: Message[] = (Array.isArray(corps?.messages) ? (corps.messages as unknown[]) : [])
      .map((m) => ({ role: String((m as Message)?.role ?? ""), content: String((m as Message)?.content ?? "") }))
      .slice(-14);
    const dernier = messages.filter((m: Message) => m.role === "user").pop();
    if (!dernier?.content) return NextResponse.json({ error: "Rien à traiter : envoie un message." }, { status: 400 });
    if (!GEMINI) return NextResponse.json({ error: "Aucune clé Gemini configurée : l'assistant à actions est indisponible." }, { status: 503 });

    // Session + rôle, relus côté serveur (jamais le rôle annoncé par le client).
    const anon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
      global: { headers: { Authorization: `Bearer ${String(corps?.authToken ?? "")}` } },
    });
    const { data: sess, error: errAuth } = await anon.auth.getUser();
    if (errAuth || !sess?.user) return NextResponse.json({ error: "Session invalide ou expirée." }, { status: 401 });
    const db = admin();
    const { data: moi } = await db.from("users").select("role").eq("id", sess.user.id).single();
    if (!["founder", "moderator"].includes(String(moi?.role ?? ""))) {
      return NextResponse.json({ error: "Accès refusé : réservé founder et moderator." }, { status: 403 });
    }
    const estFondateur = String(moi?.role) === "founder";

    const journal: { outil: string; cible?: string; resultat: Record<string, unknown> }[] = [];
    const propositions: { cible: string; id: string; email: string }[] = [];

    async function executer(nom: string, args: Record<string, any>): Promise<Record<string, unknown>> {
      if (nom === "statistiques") {
        const [u, h, m, s] = await Promise.all([
          db.from("users").select("id", { count: "exact", head: true }),
          db.from("homework").select("id", { count: "exact", head: true }),
          db.from("messages").select("id", { count: "exact", head: true }),
          db.from("schedule").select("id", { count: "exact", head: true }),
        ]);
        const r = { utilisateurs: u.count ?? 0, devoirs: h.count ?? 0, messages: m.count ?? 0, cours: s.count ?? 0 };
        journal.push({ outil: nom, resultat: r });
        return r;
      }
      if (nom === "lister_utilisateurs") {
        const t = await trouver(db, String(args?.filtre ?? ""));
        const rows = String(args?.filtre ?? "").trim() ? t.rows : (await db.from("users").select("id, email, first_name, last_name, role, tokens").order("created_at", { ascending: false }).limit(25)).data ?? [];
        const r = { trouves: rows.length, utilisateurs: rows };
        journal.push({ outil: nom, resultat: r });
        return r;
      }
      if (nom === "proposer_suppression") {
        const t = await trouver(db, String(args?.cible ?? ""));
        if (t.rows.length !== 1) return { erreur: t.rows.length ? "plusieurs comptes correspondent, précise l'e-mail" : t.motif ?? "introuvable" };
        const u = t.rows[0];
        if (!estFondateur) return { erreur: "seul un fondateur peut demander une suppression" };
        propositions.push({ cible: String(args?.cible ?? ""), id: u.id, email: u.email });
        const r = { en_attente_de_confirmation: true, compte: u.email, rappel: "Aucune suppression n'a été exécutée." };
        journal.push({ outil: nom, cible: u.email, resultat: r });
        return r;
      }
      if (nom === "donner_credits") {
        const t = await trouver(db, String(args?.cible ?? ""));
        if (t.rows.length !== 1) return { erreur: t.rows.length ? "plusieurs comptes correspondent, précise l'e-mail" : t.motif ?? "introuvable" };
        const u = t.rows[0];
        const n = Number(args?.credits);
        if (!Number.isInteger(n) || n < 0 || n > 100000) return { erreur: "`credits` doit être un entier entre 0 et 100000" };
        if (!estFondateur && u.role !== "normal") return { erreur: "un modérateur ne touche que les comptes normaux" };
        const { error } = await db.from("users").update({ tokens: n }).eq("id", u.id);
        if (error) return { erreur: error.message };
        const { data: relu } = await db.from("users").select("tokens").eq("id", u.id).single();
        const r = { avant: u.tokens, demande: n, relu_en_base: relu?.tokens ?? null };
        journal.push({ outil: nom, cible: u.email, resultat: r });
        return r;
      }
      if (nom === "changer_role") {
        const t = await trouver(db, String(args?.cible ?? ""));
        if (t.rows.length !== 1) return { erreur: t.rows.length ? "plusieurs comptes correspondent, précise l'e-mail" : t.motif ?? "introuvable" };
        const u = t.rows[0];
        const role = String(args?.role ?? "").trim() as Role;
        if (!ROLES.includes(role)) return { erreur: `rôle inconnu (${role || "vide"}) — admis : ${ROLES.join(", ")}` };
        if (!estFondateur) return { erreur: "seul un fondateur peut changer un grade" };
        const maj = { role };
        let { error } = await db.from("users").update(maj).eq("id", u.id);
        let cree = false;
        if (error) return { erreur: error.message };
        // Le profil peut manquer en base si le compte n'a jamais ouvert l'app :
        // sans ce rattrapage, l'écriture ne touche 0 ligne et le panneau affiche
        // quand même « mis à jour ». On vérifie donc par une relecture.
        const { data: relu } = await db.from("users").select("id, role").eq("id", u.id).single();
        if (!relu) {
          const { error: e2 } = await db.from("users").upsert({ id: u.id, email: u.email, role }).select("id, role").single();
          cree = !e2;
          if (e2) return { erreur: e2.message };
        }
        // Le rôle part aussi dans app_metadata : un consommateur qui lit le JWT
        // le verra au prochain rafraîchissement de session, pas avant. C'est dit,
        // pas caché.
        let miroir = "ok";
        try {
          await db.auth.admin.updateUserById(u.id, { app_metadata: { role } });
        } catch (e: unknown) {
          miroir = "non écrit (" + (e instanceof Error ? e.message.slice(0, 60) : "erreur") + ") — le rôle est appliqué dès la relecture du profil";
        }
        const apres = await db.from("users").select("role, tokens").eq("id", u.id).single();
        const r = {
          avant: u.role,
          apres: apres.data?.role ?? null,
          relu_en_base: apres.data?.role ?? null,
          ligne_cree: cree,
          compte: u.email,
          jeton: miroir,
        };
        journal.push({ outil: nom, cible: u.email, resultat: r });
        return r;
      }
      return { erreur: "outil inconnu : " + nom };
    }

    // ── Deux allers-retours avec le modèle : appel d'outil, puis réponse finale ──
    const contenus: { role: string; parts: unknown[] }[] = messages
      .filter((m: Message) => ["user", "assistant"].includes(m.role) && m.content)
      .map((m: Message) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content).slice(0, 4000) }] }));

    const appeler = async (corps: Record<string, unknown>) => {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(14000),
      });
      if (!res.ok) {
        // La raison de l'API est gardée telle quelle : « Gemini HTTP 429 » seul ne
        // dit pas si c'est le quota ou le modèle qui refuse les outils — et c'est
        // précisément ce qu'il fallait lire pour diagnostiquer (mesuré le 29/08/2026).
        let detail = "";
        try {
          const brut = await res.text();
          detail = String(JSON.parse(brut)?.error?.message ?? brut).replace(/\s+/g, " ").slice(0, 220);
        } catch {
          detail = "réponse illisible";
        }
        throw new Error(`Gemini HTTP ${res.status} — ${detail}`);
      }
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts ?? [];
    };

    // Quatre chemins, dans l'ordre : Gemini avec appels d'outils natifs, Gemini en
    // protocole texte, puis Groq dans les deux formes. Mesuré le 29/08/2026 : la clé
    // Gemini renvoyait « HTTP 429 — You exceeded your current quota » (plafond par
    // minute du compte gratuit : en espaçant les requêtes, la même question passait).
    // Avec un seul fournisseur, la console d'administration ne pouvait donc rien
    // exécuter pendant que les élèves consommaient le quota. Dans les quatre cas,
    // c'est CE serveur qui écrit en base : le modèle demande, le code vérifie, applique
    // et relit.
    type Exec = { name: string; args: Record<string, unknown>; sortie: Record<string, unknown>; id?: string };
    type Tour = { texte: string; appels: { name: string; args: Record<string, unknown>; id?: string }[]; canal: "outils" | "texte"; fournisseur: string };

    const CHARTE_TEXTE =
      CHARTE +
      ' Pour exécuter une action, réponds UNIQUEMENT par une ligne JSON de la forme {"appel":{"nom":"changer_role","arguments":{"cible":"a@b.fr","role":"moderator"}}}.' +
      " Si aucune action n'est nécessaire, réponds en texte, sans JSON.";
    // La phrase compte : écrite « ne redemande aucune action », elle faisait taire
    // la deuxième demande de l'élève (« et donne-lui 900 crédits ») — mesuré le
    // 29/08/2026, une seule des deux actions était jouée. On rejoue donc ce qui
    // reste, et on s'arrête dès que le modèle ne demande plus rien.
    // Un rappel pour le premier tour aussi : gpt-oss comme Gemini jouent volontiers
    // la première action demandée et s'arrêtent là (mesuré le 29/08/2026).
    const CHARTE_OUTILS =
      CHARTE +
      " Si la demande contient plusieurs actions distinctes, émets un appel d'outil par action, dans la même réponse.";

    const RELAIS =
      "Résume en une ou deux phrases ce qui vient d'être exécuté." +
      " Avant de répondre, relis la demande de l'élève : chaque action qu'il a demandée et qui" +
      " ne figure pas dans les résultats ci-dessus DOIT être appelée maintenant, une par une." +
      " N'écris aucun JSON si tout est déjà fait.";

    /** Le protocole texte est le même pour les deux fournisseurs : un seul parseur. */
    function lireProtocoleTexte(brut: string): { texte: string; appel?: { name: string; args: Record<string, unknown> } } {
      const m = brut.match(/\{\s*"appel"\s*:\s*\{[\s\S]*\}\s*\}/);
      if (!m) return { texte: brut.trim() };
      try {
        const demande = JSON.parse(m[0])?.appel;
        const nom = String(demande?.nom ?? "").trim();
        if (nom && nom !== "aucun") {
          return { texte: brut.replace(m[0], "").trim(), appel: { name: nom, args: (demande?.arguments ?? {}) as Record<string, unknown> } };
        }
      } catch {
        /* un JSON cassé n'exécute rien : on rend juste la réponse texte */
      }
      return { texte: brut.replace(m?.[0] ?? "", "").trim() };
    }

    const GEMINI_OK = GEMINI.length > 0;
    const GROQ = process.env.GROQ_API_KEY ?? "";

    const textes = messages
      .filter((m: Message) => ["user", "assistant"].includes(m.role) && m.content)
      .map((m: Message) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 4000) }));

    async function tourGemini(avecOutils: boolean, apres: Exec[]): Promise<Tour> {
      const c: { role: string; parts: unknown[] }[] = [...contenus];
      if (avecOutils) {
        for (const a of apres) {
          c.push({ role: "model", parts: [{ functionCall: { name: a.name, args: a.args } }] });
          c.push({ role: "user", parts: [{ functionResponse: { name: a.name, response: a.sortie } }] });
        }
        if (apres.length) c.push({ role: "user", parts: [{ text: RELAIS }] });
      } else if (apres.length) {
        c.push({ role: "model", parts: [{ text: '{"appel":{"nom":"aucun","arguments":{}}}' }] });
        c.push({ role: "user", parts: [{ text: "Résultats des appels déjà exécutés : " + JSON.stringify(apres.map((a) => a.sortie)) + ". " + RELAIS }] });
      }
      const parts = (await appeler(
        avecOutils
          ? {
              systemInstruction: { parts: [{ text: CHARTE_OUTILS }] },
              contents: c,
              tools: [{ functionDeclarations: OUTILS }],
              toolConfig: { functionCallingConfig: { mode: "AUTO" } },
            }
          : { systemInstruction: { parts: [{ text: CHARTE_TEXTE }] }, contents: c }
      )) as any[];
      const appels: Tour["appels"] = [];
      for (const p of parts) {
        if (p?.functionCall?.name) {
          appels.push({ name: String(p.functionCall.name), args: (p.functionCall.args ?? {}) as Record<string, unknown> });
        }
      }
      const brut = parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("");
      const analyse = avecOutils ? { texte: brut.trim() } : lireProtocoleTexte(brut);
      if (analyse.appel) appels.push(analyse.appel);
      return { texte: analyse.texte, appels, canal: avecOutils ? "outils" : "texte", fournisseur: "Gemini" };
    }

    async function tourGroq(avecOutils: boolean, apres: Exec[]): Promise<Tour> {
      const msgs: Record<string, unknown>[] = [{ role: "system", content: avecOutils ? CHARTE_OUTILS : CHARTE_TEXTE }, ...textes];
      if (avecOutils) {
        // Groq (format harmony) rejette un `role:"tool"` orphelin : il veut d'abord le
        // message assistant qui porte les tool_calls. Mesure du 29/08/2026 :
        // « HTTP 400 failed to render tokens with harmony », et la deuxieme action
        // demandee par l'eleve etait perdue avec ce message.
        if (apres.length) {
          msgs.push({
            role: "assistant",
            content: null,
            tool_calls: apres.map((a) => ({ id: a.id, type: "function", function: { name: a.name, arguments: JSON.stringify(a.args ?? {}) } })),
          });
          for (const a of apres) msgs.push({ role: "tool", tool_call_id: a.id, content: JSON.stringify(a.sortie) });
          msgs.push({ role: "user", content: RELAIS });
        }
      } else if (apres.length) {
        msgs.push({ role: "user", content: "Résultats des appels déjà exécutés : " + JSON.stringify(apres.map((a) => a.sortie)) + ". " + RELAIS });
      }
      const corps: Record<string, unknown> = { model: "openai/gpt-oss-20b", temperature: 0.2, max_completion_tokens: 900, messages: msgs };
      if (avecOutils) corps.tools = OUTILS.map((o: Record<string, unknown>) => ({ type: "function", function: o }));
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + GROQ },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(14000),
      });
      if (!res.ok) {
        let detail = "";
        try {
          detail = String(((await res.json()) as any)?.error?.message ?? "").replace(/\s+/g, " ").slice(0, 200);
        } catch {
          detail = "réponse illisible";
        }
        throw new Error("Groq HTTP " + res.status + (detail ? " — " + detail : ""));
      }
      const msg = ((await res.json()) as any)?.choices?.[0]?.message ?? {};
      const appels: Tour["appels"] = ((msg.tool_calls ?? []) as any[])
        .map((tc: any) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(String(tc?.function?.arguments ?? "{}"));
          } catch {
            /* arguments illisibles : l'outil est rappelé sans paramètres, refusé par la validation */
          }
          // `id: ""` et non `undefined` : le tsconfig impose exactOptionalPropertyTypes,
          // et un id vide veut dire « rien à renvoyer au fournisseur ».
          return { name: String(tc?.function?.name ?? ""), args, id: tc?.id ? String(tc.id) : "" };
        })
        .filter((a: { name: string }) => a.name);
      const brut = String(msg.content ?? "");
      const analyse = avecOutils ? { texte: brut.trim() } : lireProtocoleTexte(brut);
      if (analyse.appel) appels.push(analyse.appel);
      return { texte: analyse.texte, appels, canal: avecOutils ? "outils" : "texte", fournisseur: "Groq" };
    }

    const echecsFournisseurs: string[] = [];
    let tour1: Tour | null = null;
    for (const f of (["Gemini", "Groq"] as const)) {
      if ((f === "Gemini" && !GEMINI_OK) || (f === "Groq" && !GROQ)) continue;
      for (const avecOutils of [true, false]) {
        try {
          tour1 = f === "Gemini" ? await tourGemini(avecOutils, []) : await tourGroq(avecOutils, []);
          break;
        } catch (e: unknown) {
          const motif = String(e instanceof Error ? e.message : e);
          echecsFournisseurs.push(`${f}/${avecOutils ? "outils" : "texte"} : ${motif.slice(0, 150)}`);
          // « quota exceeded » / « rate limit » : changer de canal n'y change rien, le
          // compte est saturé pour la minute. Passer au fournisseur suivant directement
          // évite de faire attendre l'élève 14 s de plus pour le même refus.
          if (/quota|rate limit|insufficient/i.test(motif)) break;
        }
      }
      if (tour1) break;
    }
    if (!tour1) {
      return NextResponse.json(
        {
          error: "Aucun modèle d'administration n'a répondu : " + echecsFournisseurs.join(" · ") + " — aucune action n'a été exécutée.",
          actions: [],
          a_executer: [],
        },
        { status: 502 }
      );
    }
    const outillage = tour1.canal;
    const fournisseurIA = tour1.fournisseur;
    const apresExecutes: Exec[] = [];
    for (const a of tour1.appels.slice(0, 4)) {
      const sortie = await executer(String(a.name ?? ""), (a.args ?? {}) as Record<string, unknown>);
      apresExecutes.push({ name: String(a.name ?? "outil"), args: (a.args ?? {}) as Record<string, unknown>, sortie, id: a.id ?? "" });
    }

    let texte = tour1.texte;
    // Deuxième tour : le commentaire du modèle, et les actions qu'il demande APRÈS
    // avoir vu un premier résultat (« je l'ai passé moderator, je lui mets 900 ? »).
    // Mesuré le 29/08/2026 : gpt-oss ne jouait que la première des deux demandes et
    // sa relance était jetée — une action oubliée sans que personne le sache.
    let courant: Tour = tour1;
    for (let tour = 0; tour < 2 && apresExecutes.length; tour++) {
      let t2: Tour | null = null;
      try {
        t2 = courant.fournisseur === "Gemini" ? await tourGemini(courant.canal === "outils", apresExecutes) : await tourGroq(courant.canal === "outils", apresExecutes);
      } catch (e: unknown) {
        echecsFournisseurs.push(`relance ${courant.fournisseur} : ${String(e instanceof Error ? e.message : e).slice(0, 120)}`);
      }
      if (!t2) break;
      const place = Math.max(0, 4 - apresExecutes.length);
      let joues = 0;
      for (const a2 of t2.appels.slice(0, place)) {
        const sortie = await executer(String(a2.name ?? ""), (a2.args ?? {}) as Record<string, unknown>);
        apresExecutes.push({ name: String(a2.name ?? "outil"), args: (a2.args ?? {}) as Record<string, unknown>, sortie, id: a2.id ?? "" });
        joues++;
      }
      // Un commentaire écrit AVANT la dernière action ne peut pas la compter : on le
      // jette et le résumé factuel, construit avec tout ce qui a été joué, prend le relais.
      if (joues) texte = "";
      else if (t2.texte) texte = t2.texte;
      courant = t2;
      if (!t2.appels.length) break; // rien d'autre à jouer : on s'arrête là
    }
    // Si le modèle n'a pas commenté, c'est le serveur qui dit précisément ce qu'il a
    // fait — avec les valeurs relues en base, pas le seul nom de l'outil.
    if (!texte && apresExecutes.length) {
      texte =
        "Ce qui a été fait : " +
        apresExecutes
          .map((e) => {
            const r = e.sortie as Record<string, unknown>;
            if (r.erreur) return `${e.name} refusé (${String(r.erreur).slice(0, 90)})`;
            const avant = r.avant === undefined || r.avant === null ? null : String(r.avant);
            const apres = r.apres === undefined || r.apres === null ? null : String(r.apres);
            const relu = r.relu_en_base === undefined || r.relu_en_base === null ? null : String(r.relu_en_base);
            const cible = e.args.cible ? ` sur ${String(e.args.cible).slice(0, 60)}` : "";
            const valeurs = avant && apres ? ` : ${avant} → ${apres}` : apres ? ` → ${apres}` : "";
            return `${e.name}${cible}${valeurs}${relu ? ` (relu en base : ${relu})` : ""}`;
          })
          .join(" ; ") +
        ".";
    }

    if (!texte) {
      texte = journal.length
        ? "Actions exécutées : " + journal.map((j) => j.outil + (j.cible ? " sur " + j.cible : "")).join(", ") + "."
        : "Aucune action n'a été nécessaire pour répondre.";
    }

    return NextResponse.json({
      reponse: texte,
      canal: `${outillage} · ${fournisseurIA}`,
      actions: journal,
      a_executer: propositions,
      avertissements: [
        ...echecsFournisseurs.slice(0, 3).map((e) => "Fournisseur en difficulté — " + e),
        ...(estFondateur ? [] : ["Tu es modérateur : les changements de grade et les suppressions restent réservés au fondateur."]),
        ...(outillage === "texte" ? ["Le modèle n'a pas accepté l'appel d'outils natif (voir message ci-dessus) : les actions ont été demandées par protocole texte, exécutées et relues par le serveur." ] : []),
      ],
    });
  } catch (e: unknown) {
    if (e instanceof CorpsTropVolumineux) {
      // `reponse413` peut renvoyer null (corps pas encore borné) : une route qui
      // renvoie null ne compile pas — Next attend un Response. D'où le repli explicite.
      return reponse413(e) ?? NextResponse.json({ error: "Corps de requête trop volumineux." }, { status: 413 });
    }
    return NextResponse.json({ error: "Assistant indisponible : " + (e instanceof Error ? e.message.slice(0, 160) : "erreur inconnue") }, { status: 502 });
  }
}
