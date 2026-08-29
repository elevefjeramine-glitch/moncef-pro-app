import { NextResponse } from "next/server";
import { DAILY_CREDIT_FLOOR, adminConfigure, applyDailyCreditFloor, makeAdminClient, purgeAccount } from "@/lib/compte";
import { CorpsTropVolumineux, LIMITE_CORPS, lireJson, reponse413, rejeterSiAnnonceTropGrosse } from "@/lib/corps";
import { rechercherSurLeWeb, type ResultatWeb } from "@/lib/web";
import {
  charte,
  type Passage,
  type Source,
  blocContexte,
  citationsUtilisees,
  controlerCitations,
  extraireJson,
  filtrerLiensDirects,
  identifiantVideo,
  lienRechercheWeb,
  lienRechercheYouTube,
  promptAsk,
  promptQuiz,
  reponseSansSource,
  rechercher,
  validerQuiz,
} from "@/lib/thunder";

/**
 * Thunder — l'assistant ancré sur les documents de l'élève, à la NotebookLM.
 *
 * Trois modes, un seul contrat d'honnêteté :
 *   ask     réponse construite sur les passages récupérés dans SES cours, avec [S<n>]
 *   quiz    QCM généré depuis ces mêmes passages, validé structurellement avant envoi
 *   links   sujets de recherche (YouTube / web) tirés des termes du cours — jamais une
 *           URL dictée par le modèle : un lien direct n'est retenu que s'il résout
 *
 * Les crédits, la suppression programmée et le plancher quotidien suivent exactement
 * la logique de /api/chat (un seul chemin de comptabilité, pas deux versions).
 */

// 60 s : le maximum synchrone documenté par Netlify. À 45 s, les deux fournisseurs
// relancés après un 429 tombaient pile au-dessus du budget et l'élève recevait une
// erreur de passerelle au lieu de mon message « modèles indisponibles ».
export const maxDuration = 60;

import { consigneDecoupage, decouperTexte, texteBlocs, texteFiche, validerFiches, FICHES_MAX_PAR_APPEL, type Bloc } from "@/lib/fiches";

const AI_TIMEOUT_MS = 24000;
const COUT = { ask: 10, quiz: 15, links: 5, fiches: 10, sources: 0, progress: 0 } as const;

/**
 * Combien de temps attendre avant de relancer. `retry-after` d'abord (seconde ou
 * date HTTP), puis la phrase « try again in 6.6075s » que Groq écrit dans son
 * message, enfin 400 ms. Borné à 9 s : au-delà, la fonction Netlify coupe la
 * requête et l'élève n'a plus de message du tout.
 */
async function delaiConseille(res: Response, parDefaut: number): Promise<number> {
  const plafond = 9000;
  const entete = res.headers.get("retry-after");
  if (entete) {
    const sec = Number(entete);
    if (Number.isFinite(sec) && sec >= 0) return Math.min(plafond, Math.max(200, sec * 1000));
    const date = Date.parse(entete);
    if (!Number.isNaN(date)) return Math.min(plafond, Math.max(200, date - Date.now()));
  }
  try {
    const corps = await res.clone().text();
    const m = corps.match(/try again in\s+([\d.]+)\s*s/i);
    if (m) return Math.min(plafond, Math.max(200, Number(m[1]) * 1000));
  } catch {
    /* corps illisible : on garde le délai par défaut */
  }
  return Math.min(plafond, Math.max(200, parDefaut));
}

/** Un appel réseau vers les fournisseurs, borné et retenté une fois (idem /api/chat). */
async function fetchAvecDelai(url: string, init: RequestInit, tentatives = 2): Promise<Response> {
  let derniereErreur: unknown = null;
  let attente = 400;
  for (let i = 0; i < tentatives; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(AI_TIMEOUT_MS) });
      const reessayable = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
      if (!reessayable || i === tentatives - 1) return res;
      // Un 429 porte une consigne : « try again in 6.6s ». Repartir à vide 400 ms
      // après, c'est consommer un deuxième essai pour rien et voir l'élève rester
      // sur « indisponible » alors que le créneau se libérait.
      attente = await delaiConseille(res, attente);
    } catch (e: unknown) {
      derniereErreur = e;
      if (i === tentatives - 1) throw e instanceof Error ? e : new Error("Appel IA échoué");
    }
    await new Promise((r) => setTimeout(r, attente));
  }
  throw derniereErreur instanceof Error ? derniereErreur : new Error("Appel IA échoué");
}

type Corps = {
  web?: boolean; web_urls?: unknown[]; web_requete?: string;
  mode?: unknown;
  question?: unknown;
  sources?: unknown;
  source_ids?: unknown;
  include_all_sources?: unknown;
  action?: unknown;
  nouveau?: { titre?: unknown; matiere?: unknown; texte?: unknown };
  id?: unknown;
  n?: unknown;
  niveau?: unknown;
  total?: unknown;
  justes?: unknown;
  lignes?: unknown;
  /** `decouper` : reprendre le découpage après un plafond de 12 fiches, enregistrer les
   *  fiches comme sources, et matière à recopier sur chacune. */
  a_partir_de?: unknown;
  enregistrer?: unknown;
  matiere?: unknown;
};

export async function POST(req: Request) {
  // 1) taille avant tout le reste — lire un jeton, interroger la base ou bufferiser
  //    un cours de 40 Mo pour finir à la poubelle serait le pire ordre.
  const tropGrosse = rejeterSiAnnonceTropGrosse(req, LIMITE_CORPS.thunder);
  if (tropGrosse) return tropGrosse;

  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  let body: Corps;
  try {
    body = (await lireJson(req, LIMITE_CORPS.thunder)) as Corps;
  } catch (e: unknown) {
    const refus = reponse413(e);
    if (refus) return refus;
    return NextResponse.json({ error: "Corps de requête illisible : du JSON est attendu." }, { status: 400 });
  }

  const mode = String(body?.mode ?? "ask");
  if (!["ask", "quiz", "links", "fiches", "decouper", "sources", "progress"].includes(mode)) {
    return NextResponse.json({ error: "Mode inconnu : attend `ask`, `quiz`, `links`, `decouper`, `sources` ou `progress`." }, { status: 400 });
  }

  // Écrire dans thunder_sources / users demande le rôle service : sans lui, la RLS
  // laisserait lire sa propre ligne mais refuserait d'écrire — et le solde de crédits
  // ne bougerait pas. On le dit au lieu de faire semblant de marcher.
  if (!adminConfigure()) {
    return NextResponse.json(
      { error: "Service non configuré : SUPABASE_SERVICE_ROLE_KEY est absente de l'environnement d'exécution. Thunder ne peut ni enregistrer de source ni débiter de crédit." },
      { status: 503 }
    );
  }

  const admin = makeAdminClient();

  try {
    const {
      data: { user },
      error: erreurAuth,
    } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (erreurAuth || !user) return NextResponse.json({ error: "Session invalide ou expirée." }, { status: 401 });

    // ── Gestion des sources : pas d'IA, donc pas de crédit ──────────────────
    if (mode === "sources") {
      const action = String(body?.action ?? "list");
      if (action === "add") {
        const titre = String(body?.nouveau?.titre ?? "").trim().slice(0, 200);
        const matiere = String(body?.nouveau?.matiere ?? "").trim().slice(0, 80);
        const texte = String(body?.nouveau?.texte ?? "");
        if (titre.length < 2) return NextResponse.json({ error: "Un titre est nécessaire pour reconnaître la source." }, { status: 400 });
        if (texte.trim().length < 40) {
          return NextResponse.json(
            { error: "Le texte de cette source est vide ou trop court (40 caractères minimum) — rien à citer dedans." },
            { status: 400 }
          );
        }
        const { data, error } = await admin
          .from("thunder_sources")
          .insert({ user_id: user.id, titre, matiere: matiere || null, texte })
          .select("id, titre, matiere, longueur")
          .single();
        if (error) return NextResponse.json({ error: "Enregistrement impossible : " + error.message }, { status: 500 });
        return NextResponse.json({ ajoute: data });
      }
      if (action === "remove") {
        const id = String(body?.id ?? "");
        if (!id) return NextResponse.json({ error: "Identifiant de source manquant." }, { status: 400 });
        // `user_id` dans le filtre : sans lui, un identifiant deviné effacerait la
        // source d'un autre élève. La politique RLS protège aussi, mais la route ne
        // doit pas compter sur elle seule.
        const { error } = await admin.from("thunder_sources").delete().eq("id", id).eq("user_id", user.id);
        if (error) return NextResponse.json({ error: "Suppression impossible : " + error.message }, { status: 500 });
        return NextResponse.json({ supprime: id });
      }
      const { data, error } = await admin
        .from("thunder_sources")
        .select("id, titre, matiere, longueur, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return NextResponse.json({ error: "Lecture impossible : " + error.message }, { status: 500 });
      return NextResponse.json({ sources: data ?? [] });
    }

    // ── Historique du tableau interactif : aucune IA appel é, donc 0 crédit ──
    if (mode === "progress") {
      const action = String(body?.action ?? "list");
      if (action === "save") {
        const total = Number(body?.total);
        const justes = Number(body?.justes);
        const lignes = Array.isArray(body?.lignes) ? (body.lignes as unknown[]).slice(0, 40) : [];
        if (!Number.isInteger(total) || total < 1 || total > 40) {
          return NextResponse.json({ error: "`total` attendu : entier entre 1 et 40." }, { status: 400 });
        }
        if (!Number.isInteger(justes) || justes < 0 || justes > total) {
          return NextResponse.json({ error: "`justes` attendu : entier entre 0 et `total` (un score ne peut pas dépasser le nombre de questions)." }, { status: 400 });
        }
        if (!lignes.length) {
          return NextResponse.json({ error: "`lignes` attendu : le détail par question, pour que le tableau affiche autre chose qu'un score." }, { status: 400 });
        }
        const { error } = await admin.from("thunder_quiz_attempts").insert({
          user_id: user.id,
          total,
          justes,
          niveau: String(body?.niveau ?? "").slice(0, 40) || null,
          lignes,
        });
        if (error) return NextResponse.json({ error: "Enregistrement impossible : " + error.message }, { status: 500 });
        return NextResponse.json({ enregistre: true });
      }
      const { data, error } = await admin
        .from("thunder_quiz_attempts")
        .select("id, total, justes, niveau, lignes, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) return NextResponse.json({ error: "Lecture impossible : " + error.message }, { status: 500 });
      const histo = data ?? [];
      const notes = histo.map((h: { total: number; justes: number }) => (Number(h.total) ? Number(h.justes) / Number(h.total) : 0));
      return NextResponse.json({
        parties: histo,
        resume: histo.length
          ? {
              parties: histo.length,
              moyenne: Math.round((notes.reduce((x: number, y: number) => x + y, 0) / notes.length) * 100),
              derniere: histo[0]?.created_at ?? null,
            }
          : null,
      });
    }

    // ── Comptabilité, dans le même ordre que /api/chat ──────────────────────
    let { data: profil } = await admin
      .from("users")
      .select("tokens, role, tokens_reset_at, deletion_scheduled_at")
      .eq("id", user.id)
      .single();
    if (!profil) {
      const meta = user.user_metadata || {};
      const nom = String(meta.full_name || meta.name || "");
      const { data: cree } = await admin
        .from("users")
        .upsert({
          id: user.id,
          email: user.email,
          first_name: nom.split(" ")[0] || "Utilisateur",
          last_name: nom.split(" ").slice(1).join(" ") || "",
          role: "normal",
          tokens: DAILY_CREDIT_FLOOR,
        })
        .select("tokens, role, tokens_reset_at, deletion_scheduled_at")
        .single();
      profil = cree;
    }
    if (!profil) return NextResponse.json({ error: "Impossible de charger le profil utilisateur." }, { status: 500 });

    if (profil.deletion_scheduled_at && new Date(String(profil.deletion_scheduled_at)).getTime() <= Date.now()) {
      const res = await purgeAccount(admin, user.id);
      return NextResponse.json(
        { error: res.ok ? "Compte supprimé, comme demandé." : "Suppression partiellement exécutée : " + res.failed.join(" | ") },
        { status: 410 }
      );
    }

    const solde = await applyDailyCreditFloor(admin, user.id, profil);
    const illimité = ["founder", "moderator"].includes(String(profil.role));
    // ── Le web est une option posée par l'élève, question par question ────────
    // Ce n'est jamais le défaut : « je ne réponds qu'à partir de ce que tu m'as
    // donné » reste la promesse de Thunder. Ici l'élève demande explicitement
    // d'aller lire des pages, et chaque phrase citée porte alors l'URL lue.
    const webDemande = body?.web === true || (Array.isArray(body?.web_urls) && (body.web_urls as unknown[]).length > 0);
    if (webDemande && mode !== "ask") {
      return NextResponse.json(
        { error: "Le web ne se branche que sur une question (mode `ask`) : un QCM se fabrique sur TES documents, et des liens de recherche se passent de télécharger des pages." },
        { status: 400 }
      );
    }
    const webUrls = Array.isArray(body?.web_urls) ? (body.web_urls as unknown[]).map((x) => String(x)).slice(0, 4) : [];
    const webRequete = String(body?.web_requete ?? "").trim().slice(0, 300);
    const webActif = webDemande && mode === "ask";
    const SURCHARGE_WEB = 5;
    const cout: number = (COUT[mode as keyof typeof COUT] ?? 10) + (webActif ? SURCHARGE_WEB : 0);
    if (!illimité && solde < cout) {
      return NextResponse.json(
        {
          error: `Pas assez de crédits pour cette opération (${cout} requis, ${solde} disponibles). Le solde repasse à ${DAILY_CREDIT_FLOOR} au premier appel d'une nouvelle journée UTC.`,
        },
        { status: 402 }
      );
    }

    // ── Rassemblement des sources : celles du corps, plus celles de la base ──
    const sources: Source[] = [];
    const vus = new Set<string>();
    const inline = Array.isArray(body?.sources) ? (body.sources as unknown[]) : [];
    inline.forEach((raw, i) => {
      const s = raw as Record<string, unknown>;
      const id = String(s?.id ?? `L${i + 1}`).replace(/[^\w-]/g, "").slice(0, 40) || `L${i + 1}`;
      const texte = String(s?.texte ?? "").slice(0, 60000);
      if (texte.trim().length < 40 || vus.has(id)) return;
      vus.add(id);
      sources.push({ id, titre: String(s?.titre ?? `Document ${i + 1}`).slice(0, 200), matiere: String(s?.matiere ?? "").slice(0, 80), texte });
    });

    const idsDemandes = Array.isArray(body?.source_ids) ? (body.source_ids as unknown[]).map((x) => String(x).slice(0, 64)) : [];
    if (body?.include_all_sources === true || idsDemandes.length) {
      let requete = admin.from("thunder_sources").select("id, titre, matiere, texte").eq("user_id", user.id).limit(60);
      if (idsDemandes.length) requete = requete.in("id", idsDemandes.slice(0, 60));
      const { data: enBase, error: errBase } = await requete;
      if (errBase) return NextResponse.json({ error: "Lecture des sources impossible : " + errBase.message }, { status: 500 });
      for (const r of enBase ?? []) {
        const id = String(r.id);
        if (vus.has(id)) continue;
        vus.add(id);
        sources.push({ id, titre: String(r.titre ?? "Sans titre"), matiere: String(r.matiere ?? ""), texte: String(r.texte ?? "") });
      }
    }

    const question = String(body?.question ?? "").trim().slice(0, 4000) || (mode === "decouper" ? "Découpe ce cours en fiches." : "");
    if (!question) return NextResponse.json({ error: "Champ `question` attendu." }, { status: 400 });

    // Plafond de contexte : au-delà, on coupe EN LE DISANT (un élève qui colle
    // 400 000 caractères doit savoir que tout n'a pas été lu).
    const LIMITE_TEXTE = 240000;
    let total = 0;
    const retenues: Source[] = [];
    let sacrifiees = 0;
    for (const s of sources) {
      if (total + s.texte.length > LIMITE_TEXTE) {
        sacrifiees++;
        continue;
      }
      total += s.texte.length;
      retenues.push(s);
    }

    const passages = rechercher(retenues, question, mode === "quiz" ? 8 : 6);

    // ── Jambe web : on télécharge AVANT de répondre, et on ne cite que ce qu'on a lu
    let webPages: ResultatWeb[] = [];
    let webAvert: string[] = [];
    if (webActif) {
      const r = await rechercherSurLeWeb(webRequete || question, {
        env: process.env as Record<string, string | undefined>,
        lang: String((profil as { language?: string } | null)?.language ?? "fr"),
        urls: webUrls,
      });
      webPages = r.pages;
      webAvert = r.avertissements;
    }
    const passagesWeb: Passage[] = webPages.map((p, i) => ({
      sourceId: "W" + (i + 1),
      sourceTitre: "web · " + (p.titre || p.url).slice(0, 120),
      n: passages.length + i + 1,
      debut: 0,
      // Une page entière n'est pas un passage : on garde le début, là où se trouve
      // l'introduction. 1 800 caractères par page et pas 4 000 : mesuré le
      // 29/08/2026, quatre pages à 4 000 font 16 308 caractères, soit 5 620 jetons,
      // et Groq refuse au-dessus de 8 000 jetons par minute (« Requested 5620 ») —
      // le mode web se retrouvait donc systématiquement hors quota.
      texte: p.texte.slice(0, 1800),
      score: 1,
      url: p.url,
      origine: "web" as const,
      pageLue: p.pageLue,
    }));
    const material = [...passages, ...passagesWeb];
    // `decouper` ne dépend PAS de la recherche lexicale : le mode lit le texte ENTIER,
    // alors que `rechercher` ne garde que six passages pertinents pour la question posée.
    // Sans cette exception, coller un cours dont aucun mot ne ressemble à « découpe en
    // fiches » répondait « ce n'est pas dans tes documents » — mesuré le 29/08/2026,
    // et c'est exactement le genre de refus poli qui passe pour une panne de l'élève.
    const sansSource = mode === "decouper" ? null : reponseSansSource(material);

    // ── mode links : aucun lien inventé, aucune promesse de vidéo « exacte » ─
    if (mode === "links") {
      const sujets = [...new Set(question.split(/[,;\n]/).map((s) => s.trim()).filter((s) => s.length > 3))].slice(0, 8);
      const liens = sujets.map((s) => ({ type: "recherche" as const, sujet: s, youtube: lienRechercheYouTube(s), web: lienRechercheWeb(s) }));
      if (!illimité) await admin.from("users").update({ tokens: Math.max(0, solde - cout) }).eq("id", user.id);
      return NextResponse.json({
        liens: { recherche: liens, verifies: [] },
        avertissement:
          "Ces liens ouvrent une page de recherche, pas une vidéo précise : personne — ni moi ni le modèle — ne peut garantir le contenu d'une URL non vérifiée. Un lien direct n'est ajouté que s'il répond.",
        newTokens: illimité ? solde : Math.max(0, solde - cout),
      });
    }

    if (sansSource) {
      // Réponse honnête, aucun appel IA : on ne débite pas.
      // En mode quiz, le texte de refus part dans `error` : la page affiche `error`
      // en rouge et ne se retrouve pas devant un tableau vide, ce qui ressemblerait
      // à une panne du générateur plutôt qu'à l'absence de cours.
      if (mode === "quiz") {
        return NextResponse.json({ error: sansSource, debite: 0, newTokens: solde }, { status: 400 });
      }
      return NextResponse.json({
        reponse: webActif
          ? "Ni tes documents ni les pages lues ne permettent de répondre.\n\nAucune page n'a pu être téléchargée (" + (webAvert[0] ?? "aucun résultat") + "). Ajoute un cours dans le panneau « Sources », ou donne une URL qui répond."
          : sansSource,
        citations: [],
        passages: 0,
        avertissements: webAvert,
        debite: 0,
        newTokens: solde,
      });
    }

    // ── L'appel au modèle ────────────────────────────────────────────────────
    const GEMINI = process.env.GEMINI_API_KEY ?? "";
    const GROQ = process.env.GROQ_API_KEY ?? "";
    if (!GEMINI && !GROQ) {
      return NextResponse.json({ error: "Aucune clé IA configurée (GEMINI_API_KEY / GROQ_API_KEY)." }, { status: 503 });
    }

    // ── `decouper` : le pavé collé devient N blocs numérotés, AVANT l'appel au modèle ──
    // Le découpage est local (`src/lib/fiches.ts`) : le numéro de bloc est la clé de
    // tout le reste — c'est lui qui permet de jeter une fiche inventée, et de raccorder
    // la fiche à sa source d'origine. `a_partir_de` sert à reprendre là où le plafond
    // de FICHES_MAX_PAR_APPEL a coupé, sans re-fabriquer ce qui est déjà fait.
    let decoupe: { blocs: Bloc[]; sautes: number; total: number; truncate: boolean } | null = null;
    if (mode === "decouper") {
      const aPartirDe = Math.max(0, Math.round(Number(body?.a_partir_de ?? 0)));
      const texteSource = retenues.map((s) => `${s.titre ? `# ${s.titre}\n` : ""}${s.texte}`).join("\n\n");
      decoupe = decouperTexte(texteSource, { aPartirDe });
      if (!decoupe.blocs.length) {
        return NextResponse.json(
          { error: "Rien à découper : le texte fourni est vide, ou tient déjà dans une seule fiche.", debite: 0, newTokens: solde },
          { status: 400 }
        );
      }
    }

    const consigne =
      mode === "quiz"
        ? "Tu fabriques un QCM. Tu réponds UNIQUEMENT par le tableau JSON demandé, sans texte autour."
        : mode === "decouper"
          ? "Tu découpes un cours en fiches. Tu réponds UNIQUEMENT par le tableau JSON demandé, sans texte autour. Tu résumes ce que le bloc dit, tu n'ajoutes rien d'extérieur."
          : charte(webActif);
    const userPrompt =
      mode === "quiz"
        ? promptQuiz(String(body?.niveau ?? "lycée"), passages, Math.min(10, Math.max(3, Number(body?.n) || 5)))
        : mode === "decouper" && decoupe
          ? consigneDecoupage(decoupe.blocs) + texteBlocs(decoupe.blocs)
          : promptAsk(question, material);

    const fournisseurs: { nom: string; appeler: () => Promise<string> }[] = [];
    if (GEMINI) {
      fournisseurs.push({
        nom: "Gemini",
        appeler: async () => {
          // La clé voyage dans `x-goog-api-key`, plus dans `?key=`. Vérifié le 29/08/2026 sur
// l'API Google : une clé invalide envoyée par en-tête et la même envoyée en query
// string renvoient la même réponse (400 · reason=API_KEY_INVALID), donc le transport
// change rien au contrat ; en revanche une URL passe dans les journaux des proxys,
// l'historique de la fonction, parfois dans le message d'erreur — une clé non.
const res = await fetchAvecDelai("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: consigne }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error?.message || `Erreur Gemini (${res.status})`);
          return data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text ?? "").join("") ?? "";
        },
      });
    }
    if (GROQ) {
      fournisseurs.push({
        nom: "Groq",
        appeler: async () => {
          const res = await fetchAvecDelai("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GROQ}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "openai/gpt-oss-20b",
              messages: [
                { role: "system", content: consigne },
                { role: "user", content: userPrompt },
              ],
              max_tokens: mode === "quiz" || mode === "decouper" ? 3072 : 1024,
              temperature: 0.4,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error?.message || `Erreur Groq (${res.status})`);
          return data?.choices?.[0]?.message?.content ?? "";
        },
      });
    }

    let brut = "";
    const echecs: string[] = [];
    for (const f of fournisseurs) {
      try {
        const texte = String((await f.appeler()) ?? "").trim();
        if (texte) {
          brut = texte;
          break;
        }
        echecs.push(`${f.nom}: réponse vide`);
      } catch (e: unknown) {
        echecs.push(`${f.nom}: ${e instanceof Error ? e.message : "erreur inconnue"}`);
      }
    }
    if (!brut) {
      // Aucun fournisseur n'a répondu : aucun crédit débité.
      return NextResponse.json({ error: "Les modèles d'IA sont momentanément indisponibles.", details: echecs.join(" | ") }, { status: 502 });
    }

    // ── `decouper` : rien n'est débité ni enregistré si la réponse ne tient pas ────
    if (mode === "decouper" && decoupe) {
      const validation = validerFiches(brut, decoupe.blocs);
      if (!validation.ok) {
        return NextResponse.json(
          {
            error: "Le découpage reçu est inexploitable : rien n'est enregistré, rien n'est débité.",
            motif: validation.motif,
            blocs_preparés: decoupe.blocs.length,
            debite: 0,
            newTokens: solde,
          },
          { status: 502 }
        );
      }
      const parIndex = new Map(decoupe.blocs.map((b) => [b.index, b]));
      const fiches = validation.fiches.map((f) => {
        const bloc = parIndex.get(f.fiche)!;
        return { ...f, caractères: bloc.caractères, extrait: bloc.texte.slice(0, 900) };
      });

      // `enregistrer: true` écrit une ligne `thunder_sources` par fiche : c'est ce qui
      // les rend ré-interrogeables (QCM, appels suivants). À 12 fiches par appel et
      // 12 000 caractères par fiche, on reste très sous le plafond Netlify de 6 Mo —
      // et sous le bon sens : une fiche de cours ne fait pas 60 000 caractères.
      let enregistrees = 0;
      const sourceIds: string[] = [];
      if (body?.enregistrer === true) {
        const lignes = fiches.map((f) => ({
          user_id: user.id,
          titre: `Fiche ${f.fiche + 1} · ${f.titre}`.slice(0, 200),
          matiere: String(body?.matiere ?? "").trim().slice(0, 80) || null,
          texte: texteFiche(parIndex.get(f.fiche)!, f),
        }));
        const { data: ecrites, error } = await admin.from("thunder_sources").insert(lignes).select("id");
        if (error) {
          return NextResponse.json(
            { error: "Découpage calculé mais non enregistré : " + error.message, fiches, debite: 0, newTokens: solde },
            { status: 500 }
          );
        }
        enregistrees = (ecrites ?? []).length;
        sourceIds.push(...(ecrites ?? []).map((r: { id: string }) => String(r.id)));
      }

      if (!illimité) await admin.from("users").update({ tokens: Math.max(0, solde - cout) }).eq("id", user.id);
      return NextResponse.json({
        fiches,
        jetees: validation.jetees,
        blocs_envoyés: decoupe.blocs.length,
        restants: decoupe.sautes,
        a_partir_de_suggéré: decoupe.sautes > 0 ? Number(body?.a_partir_de ?? 0) + decoupe.blocs.length : null,
        plafond_par_appel: FICHES_MAX_PAR_APPEL,
        enregistrees,
        source_ids: sourceIds,
        avertissement:
          "Les titres et points clés viennent du modèle, le corps des fiches vient uniquement de ton texte. Les fiches ne sont pas relues : ce qu'elles omettent n'apparaît nulle part." +
          (decoupe.truncate ? " Le texte a aussi été tronqué à la lecture : tout n'a pas été découpé." : "") +
          (decoupe.sautes > 0 ? ` ${decoupe.sautes} bloc(s) n'ont pas été traités (plafond de ${FICHES_MAX_PAR_APPEL} fiches par appel) — relance pour la suite.` : ""),
        debite: illimité ? 0 : cout,
        newTokens: illimité ? solde : Math.max(0, solde - cout),
      });
    }

    // ── `quiz` : validation structurelle AVANT envoi, sinon refus ────────────
    if (mode === "quiz") {
      const numeros = new Set(passages.map((p) => p.n));
      const validation = validerQuiz(extraireJson(brut), numeros);
      if (!validation.ok) {
        return NextResponse.json(
          {
            error: "Le QCM reçu est incomplet ou incohérent — il n'est pas envoyé plutôt que d'être corrigé à l'aveugle.",
            motif: validation.motif,
            debite: 0,
          },
          { status: 502 }
        );
      }
      // Les questions ne citent que des passages existants ; on joint les extraits
      // correspondants pour que l'élève voie la preuve, pas seulement la référence.
      const parNumero = new Map(passages.map((p) => [p.n, p]));
      const questions = validation.questions.map((q) => ({
        ...q,
        extrait: parNumero.get(Number(q.source.replace("S", "")))?.texte.slice(0, 420) ?? "",
      }));
      if (!illimité) await admin.from("users").update({ tokens: Math.max(0, solde - cout) }).eq("id", user.id);
      return NextResponse.json({
        questions,
        passages_utilises: passages.map((p) => ({ n: p.n, titre: p.sourceTitre, score: p.score })),
        sources_non_lues: sacrifiees,
        debite: illimité ? 0 : cout,
        newTokens: illimité ? solde : Math.max(0, solde - cout),
      });
    }

    // ── `ask` : citations contrôlées, liens directs vérifiés ─────────────────
    const controle = controlerCitations(brut, material);
    const citations = citationsUtilisees(controle.texte, material).map((p) => ({
      n: p.n,
      titre: p.sourceTitre,
      extrait: p.texte.slice(0, 500),
      url: p.url ?? null,
      origine: p.origine ?? "cours",
      page_lue: p.pageLue ?? true,
    }));

    // Le modèle peut proposer des URL en fin de réponse : on ne les garde que si
    // elles résolvent, et le titre affiché vient alors de la plateforme.
    const urlsCand = [...controle.texte.matchAll(/https?:\/\/[^\s)>\]]+/g)].map((m) => ({ url: m[0] }));
    const liensDirects = await filtrerLiensDirects(urlsCand, async (url) => {
      if (!identifiantVideo(url)) return null; // seul YouTube est vérifiable proprement ici
      try {
        const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return null;
        const j = await r.json();
        return { ok: true, titre: String(j?.title ?? ""), auteur: String(j?.author_name ?? "") };
      } catch {
        return null;
      }
    });

    const sansCitation = citations.length === 0;
    if (!illimité) await admin.from("users").update({ tokens: Math.max(0, solde - cout) }).eq("id", user.id);

    return NextResponse.json({
      reponse: controle.texte,
      citations,
      avertissements: [
        sansCitation ? "Aucun passage n'est référencé dans la réponse du modèle : considère-la comme non sourcée." : "",
        passagesWeb.length ? "Cette réponse s'appuie sur " + passagesWeb.length + " page(s) du web (" + passagesWeb.map((p) => {
            // Le titre distingue deux pages du même site ; l'URL tronquée à 40
            // caractères affichait « Photosynthèse » deux fois pour deux pages
            // différentes (mesuré le 29/08/2026) — une phrase fausse, donc corrigée.
            const t = String(p.sourceTitre ?? "").replace(/^web\s*·\s*/, "").trim();
            const court = t || String(p.url ?? "").replace(/^https?:\/\//, "");
            return court.length > 34 ? court.slice(0, 34) + "…" : court;
          }).join(", ") + ") — pas uniquement sur tes documents." : "",
        passagesWeb.some((p) => !p.pageLue) ? "Une page n'a pas pu être ouverte : seul son extrait de recherche a été cité." : "",
        ...webAvert.map((a) => "web : " + a),
        controle.rejets.length ? `Références écartées car absentes de tes documents : ${controle.rejets.join(", ")}.` : "",
        sacrifiees ? `${sacrifiees} document(s) non lu(s) : le contexte dépasse ${LIMITE_TEXTE.toLocaleString("fr-FR")} caractères.` : "",
      ].filter(Boolean),
      liens: {
        verifies: liensDirects,
        recherche: [
          { sujet: question.slice(0, 120), youtube: lienRechercheYouTube(question), web: lienRechercheWeb(question) },
        ],
      },
      contexte: { passages: material.length, dont_web: passagesWeb.length, caracteres: total, blocs: blocContexte(material).length },
      debite: illimité ? 0 : cout,
      newTokens: illimité ? solde : Math.max(0, solde - cout),
    });
  } catch (e: unknown) {
    if (e instanceof CorpsTropVolumineux) {
      // `reponse413` renvoie `NextResponse | null` (il ne connaît le type d'erreur
      // que s'il s'agit bien du notre). Rendre le null tel quel faisait échouer le
      // build Next — et, sans ce contrôle de type, aurait pu renvoyer un corps vide.
      const refus = reponse413(e);
      return refus ?? NextResponse.json({ error: "Corps de requête trop volumineux pour Thunder." }, { status: 413 });
    }
    console.error("[thunder]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Thunder n'a pas pu répondre.", details: e instanceof Error ? e.message : undefined }, { status: 500 });
  }
}

/** GET = l'inventaire des sources, sans passer par POST (lisibilité du panneau). */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const admin = makeAdminClient();
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(auth.replace("Bearer ", ""));
  if (error || !user) return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  const { data, error: err } = await admin
    .from("thunder_sources")
    .select("id, titre, matiere, longueur, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (err) return NextResponse.json({ error: "Lecture impossible : " + err.message }, { status: 500 });
  return NextResponse.json({ sources: data ?? [], credits_par_mode: { ...COUT, ask_web: COUT.ask + 5 } });
}
