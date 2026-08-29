/**
 * Thunder — la jambe web.
 *
 * Règle unique de ce fichier : ne jamais faire croire à un élève qu'une
 * information vient du web alors que personne ne l'a lue. Donc :
 *
 *   • aucune URL n'est demandée au modèle « de mémoire » ;
 *   • chaque passage web est le TEXTE RÉELLEMENT téléchargé, avec son URL ;
 *   • si rien n'a pu être téléchargé, Thunder le dit et n'appelle pas le modèle.
 *
 * Trois jambes, dans cet ordre, toutes mesurées le 29/08/2026 :
 *   1. les URL collées par l'élève (lecture directe, la source est la sienne) ;
 *   2. une API de recherche si une clé est configurée (Brave, Serper ou Tavily) ;
 *   3. l'API de recherche de Wikipédia — sans clé, JSON stable, URL canoniques.
 *
 * Écarté après mesure, pas par goût : DuckDuckGo (html et lite) répond HTTP 202
 * avec une page de défi anti-bot ; Mojeek 403 ; Marginalia 302 ; Searx /format=json
 * 200 mais vide. Bing répond 200 et se parse (10 blocs `li.b_algo` sur 10), mais
 * les résultats n'ont aucun rapport avec la requête et les URL sont des
 * redirections `bing.com/ck/a` — du bruit déguisé en web.
 */

export type ResultatWeb = {
  url: string;
  titre: string;
  /** court, servi par le moteur ; c'est le filet de sécurité si la page ne se lit pas */
  extrait: string;
  /** texte réellement téléchargé et nettoyé — vide si la page a refusé */
  texte: string;
  /** d'où vient le résultat, pour l'afficher à l'élève sans le lui faire deviner */
  origine: "collee" | "api" | "wikipedia";
  pageLue: boolean;
};

const DELAI_RESEAU = 12_000;
const PAGE_MAX = 4;
/** Au-delà on tronque EN LE DISANT : un élève doit savoir ce qui n'a pas été lu. */
const TEXTE_PAR_PAGE = 9_000;
const OCTETS_PAR_PAGE = 400_000;
const MIN_TEXTE_EXPLOITABLE = 120;

// ─────────────────────────────────────────────────────────────────────────────
// Garde-fous : un serveur qui télécharge ce qu'on lui dicte est un relais ouvert
// ─────────────────────────────────────────────────────────────────────────────

const HOTES_INTERDITS = /^(localhost|.*\.local(?:domain)?|.*\.internal|host\.docker\.internal|metadata\.google|169\.254\.169\.254)$/i;

/**
 * Sans ce filtre, `https://localhost:3000/` ou `https://169.254.169.254/`
 * (métadonnées de la machine) deviendraient des « sources » lisibles depuis la
 * fonction. Donc : https seul, pas de port, pas d'identifiants dans l'URL,
 * pas d'hôte réservé, pas d'IP privée.
 */
export function urlAutorisee(brut: string): { ok: boolean; motif?: string; url?: string } {
  // Un élève colle « fr.wikipedia.org/wiki/X » sans schéma. On complète, mais en
  // https uniquement : ce n'est pas à la saisie de dire si le clair est permis.
  let net = String(brut).trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(net) && /^[\w-]+(\.[\w-]+)+([/?#][^\s]*)?$/.test(net)) net = "https://" + net;
  let u: URL;
  try {
    u = new URL(net);
  } catch {
    return { ok: false, motif: "URL illisible" };
  }
  if (u.protocol !== "https:") return { ok: false, motif: "https uniquement" };
  const h = u.hostname.toLowerCase();
  // L'ordre compte : « localhost » doit être dit comme ce qu'il est (hôte réservé),
  // pas comme un hostname mal formé — un élève qui lit « nom d'hôte incomplet »
  // cherche une faute de frappe qui n'existe pas.
  if (HOTES_INTERDITS.test(h)) return { ok: false, motif: "hôte réservé" };
  if (!h.includes(".") && !/^\d+\.\d+\.\d+\.\d+$/.test(h)) return { ok: false, motif: "nom d'hôte incomplet" };
  if (u.port) return { ok: false, motif: "port explicite refusé" };
  if (u.username || u.password) return { ok: false, motif: "identifiants dans l'URL" };
  const ip = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip) {
    const a = Number(ip[1]);
    const b = Number(ip[2]);
    const privee = a === 0 || a === 10 || a === 127 || a >= 224 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
    if (privee) return { ok: false, motif: "adresse privée ou réservée" };
  }
  return { ok: true, url: u.toString() };
}

/** HTML → texte. Pas de dépendance : on retire ce qu'un élève ne lit pas. */
export function texteDepuisHtml(html: string): string {
  return String(html ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|form|nav|footer|header|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, TEXTE_PAR_PAGE);
}

export function titreDepuisHtml(html: string, fallback: string): string {
  const m = String(html ?? "").match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  const t = m ? texteDepuisHtml(m[1] ?? "") : "";
  return (t || fallback).slice(0, 180);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture d'une page
// ─────────────────────────────────────────────────────────────────────────────

async function fetchDelai(url: string, init: RequestInit = {}, ms = DELAI_RESEAU): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

type Lecture = { url: string; titre: string; texte: string; erreur?: string | undefined };

/** Retourne `erreur` au lieu de lever : l'appelant doit pouvoir l'écrire à l'élève. */
export async function lirePage(brut: string): Promise<Lecture> {
  const garde = urlAutorisee(brut);
  if (!garde.ok) return { url: String(brut).slice(0, 200), titre: "", texte: "", erreur: garde.motif };
  const url = garde.url!;
  try {
    const res = await fetchDelai(url, {
      headers: { "user-agent": enTete("MoncefIA/1.0 (lecture d'une page demandee par un eleve)") },
      cache: "no-store",
    });
    // Le garde-fou est rejoué sur l'URL FINALE : une redirection vers 127.0.0.1
    // ne doit pas passer par le trou.
    if (res.url) {
      const finale = urlAutorisee(res.url);
      if (!finale.ok) return { url, titre: "", texte: "", erreur: `redirige vers un hôte ${finale.motif}` };
    }
    if (!res.ok) return { url, titre: "", texte: "", erreur: `HTTP ${res.status}` };
    const html = (await res.text()).slice(0, OCTETS_PAR_PAGE);
    const texte = texteDepuisHtml(html);
    if (texte.length < MIN_TEXTE_EXPLOITABLE) return { url, titre: "", texte: "", erreur: "page sans texte exploitable" };
    return { url: res.url || url, titre: titreDepuisHtml(html, safeHostname(url)), texte };
  } catch (e: unknown) {
    return { url, titre: "", texte: "", erreur: (e instanceof Error ? e.message : "réseau").slice(0, 90) };
  }
}

function safeHostname(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return u.slice(0, 60);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Jambe 2 : API de recherche (si une clé existe)
// ─────────────────────────────────────────────────────────────────────────────

export type Candidat = { url: string; titre: string; extrait: string };
export type NomApi = "brave" | "serper" | "tavily";

/** Les trois formats sont analysés à la main, d'après la réponse réelle de chaque API. */
export function lireRechercheApi(nom: NomApi, json: unknown): Candidat[] {
  const d = json as Record<string, any>;
  if (nom === "brave") {
    return (d?.web?.results ?? d?.results ?? []).slice(0, PAGE_MAX).map((r: any) => ({
      url: String(r?.url ?? ""),
      titre: String(r?.title ?? ""),
      extrait: String(r?.description ?? ""),
    }));
  }
  if (nom === "serper") {
    return (d?.organic ?? []).slice(0, PAGE_MAX).map((r: any) => ({
      url: String(r?.link ?? ""),
      titre: String(r?.title ?? ""),
      extrait: String(r?.snippet ?? ""),
    }));
  }
  return (d?.results ?? []).slice(0, PAGE_MAX).map((r: any) => ({
    url: String(r?.url ?? ""),
    titre: String(r?.title ?? ""),
    extrait: String(r?.content ?? ""),
  }));
}

export function fournisseurRecherche(env: Record<string, string | undefined>): { nom: NomApi; cle: string } | null {
  if (env?.BRAVE_API_KEY) return { nom: "brave", cle: env.BRAVE_API_KEY! };
  if (env?.SERPER_API_KEY) return { nom: "serper", cle: env.SERPER_API_KEY! };
  if (env?.TAVILY_API_KEY) return { nom: "tavily", cle: env.TAVILY_API_KEY! };
  return null;
}

/** Le corps de requête de chaque fournisseur, isolé pour être testé sans réseau. */
export function requeteApi(nom: NomApi, requete: string, cle: string): { url: string; method: string; headers: Record<string, string>; body?: string } {
  const q = encodeURIComponent(requete);
  if (nom === "brave") {
    return {
      url: `https://api.search.brave.com/res/v1/web/search?q=${q}&count=${PAGE_MAX}&search_lang=fr`,
      method: "GET",
      headers: { Accept: "application/json", "X-Subscription-Token": enTete(cle) },
    };
  }
  if (nom === "serper") {
    return {
      url: "https://google.serper.dev/search",
      method: "POST",
      headers: { Accept: "application/json", "X-API-KEY": enTete(cle), "Content-Type": "application/json" },
      body: JSON.stringify({ q: requete, gl: "fr", hl: "fr", num: PAGE_MAX }),
    };
  }
  return {
    url: "https://api.tavily.com/search",
    method: "POST",
    headers: { Accept: "application/json", Authorization: enTete(`Bearer ${cle}`), "Content-Type": "application/json" },
    body: JSON.stringify({ query: requete, max_results: PAGE_MAX, include_answer: false, search_depth: "basic" }),
  };
}

async function viaApi(requete: string, fou: { nom: NomApi; cle: string }): Promise<{ candidats: Candidat[]; erreur?: string | undefined }> {
  const conf = requeteApi(fou.nom, requete, fou.cle);
  try {
    const init: RequestInit = { method: conf.method as "GET" | "POST", headers: conf.headers };
    if (conf.body) init.body = conf.body; // `exactOptionalPropertyTypes` : pas de clé à undefined
    const res = await fetchDelai(conf.url, init);
    if (!res.ok) return { candidats: [], erreur: `${fou.nom} a répondu HTTP ${res.status}` };
    const candidats = lireRechercheApi(fou.nom, await res.json()).filter((c) => c.url.startsWith("https://"));
    return { candidats, erreur: candidats.length ? undefined : `${fou.nom} n'a rien trouvé` };
  } catch (e: unknown) {
    return { candidats: [], erreur: `${fou.nom} injoignable (${(e instanceof Error ? e.message : "réseau").slice(0, 60)})` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Jambe 3 : Wikipédia, sans clé
// ─────────────────────────────────────────────────────────────────────────────

export function wikipediaUrl(requete: string, lang: string, limite = PAGE_MAX): string {
  return (
    `https://${encodeURIComponent(lang)}.wikipedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(requete)}&gsrlimit=${limite}&prop=extracts|info&exintro=1&explaintext=1&redirects=1&format=json&formatversion=2`
  );
}

/** URL canonique fabriquée par l'API ; le repli n'est utile que si l'API ne la donne pas. */
export function urlArticleWikipedia(lang: string, titre: string): string {
  return `https://${encodeURIComponent(lang)}.wikipedia.org/wiki/${encodeURIComponent(String(titre).replace(/ /g, "_"))}`;
}

export function lireWikipedia(json: unknown, lang: string): Candidat[] {
  const pages = (json as any)?.query?.pages;
  if (!pages) return [];
  return Object.values(pages as Record<string, any>)
    .map((p: any) => ({
      url: String(p?.canonicalurl || urlArticleWikipedia(lang, String(p?.title ?? ""))),
      titre: String(p?.title ?? "").replace(/_/g, " "),
      extrait: String(p?.extract ?? "").replace(/\s+/g, " ").trim(),
    }))
    .filter((c) => c.extrait.length > 40 && c.url.startsWith("https://"))
    .slice(0, PAGE_MAX);
}

async function viaWikipedia(requete: string, lang: string): Promise<{ candidats: Candidat[]; erreur?: string | undefined }> {
  try {
    const res = await fetchDelai(wikipediaUrl(requete, lang), {
      headers: { "user-agent": enTete("MoncefIA/1.0 (recherche encyclopedique pour un eleve)") },
    });
    if (!res.ok) return { candidats: [], erreur: `wikipédia a répondu HTTP ${res.status}` };
    const candidats = lireWikipedia(await res.json(), lang);
    return { candidats, erreur: candidats.length ? undefined : "wikipédia n'a rien trouvé" };
  } catch (e: unknown) {
    return { candidats: [], erreur: `wikipédia injoignable (${(e instanceof Error ? e.message : "réseau").slice(0, 60)})` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrée du service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un en-tête HTTP ne transporte que des octets Latin-1 : `fetch` LEVE sinon
 * (« Cannot convert argument to a ByteString… »), et la page ne se lit pas.
 * Mesuré le 29/08/2026 : un « — » et un « ’ » dans mon propre User-Agent
 * suffisaient à faire échouer 100 % des lectures, sans message d'erreur parlant.
 * Donc : tout en-tête construit ici passe par cette fonction.
 */
export function enTete(valeur: string): string {
  // Les non-ASCII sont remplacés par un espace plutôt que supprimés : « élève »
  // devient « l ve », toujours lisible, jamais une exception réseau.
  return valeur.replace(/[^\u0009\u0020-\u007E\u00A0-\u00FF]/g, " ");
}

export async function rechercherSurLeWeb(
  requete: string,
  opts: { env?: Record<string, string | undefined>; lang?: string; urls?: string[] }
): Promise<{ pages: ResultatWeb[]; avertissements: string[] }> {
  const env = opts.env ?? {};
  const avertissements: string[] = [];
  const pages: ResultatWeb[] = [];
  const vus = new Set<string>();

  // 1. Les URL choisies par l'élève d'abord : ce sont les seules qu'il a lui-même pointées.
  const collees = (opts.urls ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, PAGE_MAX);
  const lectures = await Promise.all(collees.map((u) => lirePage(u)));
  for (let i = 0; i < lectures.length; i++) {
    const l = lectures[i];
    if (!l) continue;
    if (!l.texte) {
      avertissements.push(`ta page « ${short(l.url)} » n'a pas pu être lue (${l.erreur ?? "raison inconnue"})`);
      continue;
    }
    if (vus.has(l.url)) continue;
    vus.add(l.url);
    pages.push({ url: l.url, titre: l.titre || safeHostname(l.url), extrait: l.texte.slice(0, 300), texte: l.texte, origine: "collee", pageLue: true });
  }

  // 2 + 3. Recherche, s'il reste de la place et qu'une vraie question a été posée.
  const q = String(requete ?? "").trim();
  if (q.length > 2 && pages.length < PAGE_MAX) {
    let candidats: (Candidat & { origine: "api" | "wikipedia" })[] = [];
    const fou = fournisseurRecherche(env);
    if (fou) {
      const r = await viaApi(q, fou);
      candidats = r.candidats.map((c) => ({ ...c, origine: "api" as const }));
      if (!candidats.length) avertissements.push(`la recherche ${fou.nom} n'a pas abouti (${r.erreur ?? "aucun résultat"})`);
    }
    if (!candidats.length) {
      const lang = /^(en|es|ar|zh|de|it)$/i.test(opts.lang ?? "") ? String(opts.lang).toLowerCase() : "fr";
      const r = await viaWikipedia(q, lang);
      candidats = r.candidats.map((c) => ({ ...c, origine: "wikipedia" as const }));
      if (!candidats.length) avertissements.push(`l'encyclopédie non plus (${r.erreur ?? "aucun article"})`);
    }

    // Déduplication AVANT téléchargement : le moteur renvoie parfois deux fois le
    // même article (une requête qui rebondit sur une redirection). Mesuré sur le
    // brouillon du 29/08/2026 : la page « Photosynthèse » arrivait en [S1] ET en
    // [S4] — deux citations pour une seule source, et du contexte gaspillé.
    const vus2 = new Set<string>();
    const restants = candidats
      .filter((c) => {
        if (vus.has(c.url) || vus2.has(c.url)) return false;
        vus2.add(c.url);
        return true;
      })
      .slice(0, PAGE_MAX - pages.length);
    const lues = await Promise.all(restants.map((c) => lirePage(c.url)));
    for (let i = 0; i < restants.length; i++) {
      const c = restants[i]!;
      const l = lues[i] ?? { url: c.url, titre: "", texte: "", erreur: "lecture non effectuée" };
      vus.add(c.url);
      if (l.texte) {
        pages.push({ url: c.url, titre: c.titre || l.titre || safeHostname(c.url), extrait: c.extrait.slice(0, 300), texte: l.texte, origine: c.origine, pageLue: true });
      } else {
        // L'extrait du moteur est un fait relevé par une recherche, pas une
        // invention du modèle : on l'utilise, en le disant à l'élève.
        if (c.extrait.length >= MIN_TEXTE_EXPLOITABLE) {
          pages.push({ url: c.url, titre: c.titre || safeHostname(c.url), extrait: c.extrait.slice(0, 300), texte: c.extrait.slice(0, TEXTE_PAR_PAGE), origine: c.origine, pageLue: false });
          avertissements.push(`« ${short(c.url)} » non ouverte (${l.erreur ?? "page vide"}) : seul l'extrait du moteur a été lu`);
        } else {
          avertissements.push(`« ${short(c.url)} » écartée (${l.erreur ?? "rien à citer}"})`);
        }
      }
    }
  }

  if (!pages.length) avertissements.push("rien n'a pu être lu sur le web");

  return { pages: pages.slice(0, PAGE_MAX), avertissements: [...new Set(avertissements)].slice(0, 6) };
}

function short(u: string): string {
  const h = safeHostname(u);
  return (h || u).slice(0, 60);
}
