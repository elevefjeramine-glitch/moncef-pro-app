/* eslint-disable */
/**
 * Vérifications de la jambe web de Thunder. Aucun réseau : `fetch` est remplacé
 * par des réponses posées ici, exactement au format des API appelées (relevé le
 * 29/08/2026). Ce qui est vérifié en priorité : ce qui ne doit JAMAIS passer.
 */
const path = require("path");
const W = require(path.join(__dirname, "..", ".verif", "web.js"));

let ok = 0;
const echecs = [];
function nom(label, cond, detail) {
  if (cond) {
    ok++;
    console.log("   OK  " + label + (detail !== undefined ? "  → " + JSON.stringify(detail) : ""));
  } else {
    echecs.push(label + (detail !== undefined ? " · " + JSON.stringify(detail) : ""));
    console.log("   RATÉ " + label + (detail !== undefined ? "  → " + JSON.stringify(detail) : ""));
  }
}

// ── Le garde-fou qui empêche la fonction de servir de relais ─────────────────
{
  const acceptees = ["https://fr.wikipedia.org/wiki/%C3%89nergie_cin%C3%A9tique", "https://example.com/cours/page.html?x=1"];
  const refusees = [
    ["http://fr.wikipedia.org/wiki/X", "http"],
    ["https://localhost:3000/", "localhost"],
    ["https://127.0.0.1/", "boucle"],
    ["https://10.0.0.5/admin", "réseau privé"],
    ["https://192.168.1.1/", "réseau local"],
    ["https://172.16.0.9/", "réseau privé"],
    ["https://169.254.169.254/latest/meta-data/", "métadonnées du cloud"],
    ["https://metadata.google.internal/", "métadonnées GCP"],
    ["https://example.com:8443/", "port"],
    ["https://user:pass@example.com/", "identifiants"],
    ["pas une url", "illisible"],
    ["javascript:alert(1)", "schéma"],
  ];
  nom("urlAutorisee: les URL publiques passent", acceptees.every((u) => W.urlAutorisee(u).ok), acceptees.map((u) => W.urlAutorisee(u).ok));
  const fuites = refusees.filter(([u]) => W.urlAutorisee(u).ok);
  nom("urlAutorisee: rien d'interne ne passe", fuites.length === 0, fuites.map(([_, q]) => q));
  nom("urlAutorisee: localhost est dit « hôte réservé », pas « mal formé »", W.urlAutorisee("https://localhost:3000/").motif === "port explicite refusé" || W.urlAutorisee("https://localhost/x").motif === "hôte réservé", W.urlAutorisee("https://localhost/x").motif);
}

// ── HTML → texte ────────────────────────────────────────────────────────────
{
  const html = "<html><head><title>Énergie cinétique — Wikipédia</title><style>p{color:red}</style></head><body><nav>menu menu menu</nav><script>var x=1&lt;2;</script><h1>Énergie</h1><p>L'énergie&nbsp;cinétique vaut&nbsp;1/2·m·v².</p><footer>pied</footer></body></html>";
  const t = W.texteDepuisHtml(html);
  nom("texteDepuisHtml: le texte utile survit", /1\/2·m·v²/.test(t) && t.includes("cinétique"), t.slice(0, 60));
  nom("texteDepuisHtml: script, style, nav, footer sautés", !/var x|color:red|menu|pied/.test(t), t.slice(0, 40));
  nom("texteDepuisHtml: entités décodées", t.includes(" ") && !t.includes("&nbsp;"), "« &nbsp; » → espace");
  const gros = "a".repeat(40_000);
  nom("texteDepuisHtml: plafond de 9 000 caractères", W.texteDepuisHtml("<p>" + gros + "</p>").length === 9000, W.texteDepuisHtml("<p>" + gros + "</p>").length);
  nom("titreDepuisHtml: le titre vient de la page", W.titreDepuisHtml(html, "repli") === "Énergie cinétique — Wikipédia", W.titreDepuisHtml(html, "repli"));
  nom("titreDepuisHtml: repli si pas de titre", W.titreDepuisHtml("<p>x</p>", "exemple.org") === "exemple.org");
}

// ── Les trois formats d'API de recherche ────────────────────────────────────
{
  const brave = { web: { results: [{ title: "Énergie cinétique", url: "https://a.example/x", description: "snippet" }] } };
  const serper = { organic: [{ title: "T", link: "https://b.example/y", snippet: "s" }] };
  const tavily = { results: [{ title: "T2", url: "https://c.example/z", content: "c" }] };
  nom("lireRechercheApi: brave", W.lireRechercheApi("brave", brave)[0]?.url === "https://a.example/x", W.lireRechercheApi("brave", brave));
  nom("lireRechercheApi: serper (link, pas url)", W.lireRechercheApi("serper", serper)[0]?.url === "https://b.example/y");
  nom("lireRechercheApi: tavily (content)", W.lireRechercheApi("tavily", tavily)[0]?.extrait === "c");
  nom("lireRechercheApi: réponse vide ne casse pas", W.lireRechercheApi("brave", null).length === 0 && W.lireRechercheApi("serper", {}).length === 0);
}

// ── Wikipédia : la forme réelle de la réponse (formatversion=2) ─────────────
{
  const json = {
    query: {
      pages: [
        { title: "Énergie cinétique", canonicalurl: "https://fr.wikipedia.org/wiki/%C3%89nergie_cin%C3%A9tique", extract: "En physique, l'énergie cinétique est l'énergie que possède un corps du fait de son mouvement." },
        { title: "Chat", canonicalurl: "https://fr.wikipedia.org/wiki/Chat", extract: "trop court" },
      ],
    },
  };
  const r = W.lireWikipedia(json, "fr");
  nom("lireWikipedia: ne garde que ce qui a une substance", r.length === 1, r.map((x) => x.titre));
  nom("lireWikipedia: l'URL canonique vient de l'API", r[0].url === "https://fr.wikipedia.org/wiki/%C3%89nergie_cin%C3%A9tique");
  nom("lireWikipedia: repli d'URL si l'API ne la donne pas", W.urlArticleWikipedia("fr", "Énergie cinétique").includes("wikipedia.org/wiki/"), W.urlArticleWikipedia("fr", "Énergie cinétique"));
  nom("lireWikipedia: réponse sans pages = tableau vide", W.lireWikipedia({ batchcomplete: true }, "fr").length === 0);
}

// ── La clé d'API ne doit jamais voyager dans une URL ─────────────────────────
{
  const r1 = W.requeteApi("brave", "énergie cinétique", "CLE-SECRETE");
  const r2 = W.requeteApi("serper", "q", "CLE-SECRETE");
  const r3 = W.requeteApi("tavily", "q", "CLE-SECRETE");
  nom("requeteApi: la clé est dans un en-tête, jamais dans l'URL", ![r1, r2, r3].some((r) => r.url.includes("CLE-SECRETE")), { r1: r1.url.slice(0, 44), r2: r2.headers["X-API-KEY"] ? "en-tête" : "?" });
  nom("requeteApi: requête encodée", r1.url.includes("%C3%A9nergie%20cin%C3%A9tique") || r1.url.includes("%C3%A9nergie+cin%C3%A9tique"), r1.url.slice(0, 70));
  nom("urlAutorisee: « exemple.org/page » sans schéma devient https", W.urlAutorisee("exemple.org/page").url === "https://exemple.org/page", W.urlAutorisee("exemple.org/page").url);
  nom("urlAutorisee: le http explicite n'est pas corrigé en https par bonté", W.urlAutorisee("http://exemple.org").ok === false, W.urlAutorisee("http://exemple.org").motif);
  nom("urlAutorisee: du texte qui n'est pas une URL reste refusé", W.urlAutorisee("mon cours de physique").ok === false, W.urlAutorisee("mon cours de physique").motif);
  nom("fournisseurRecherche: ordre de préférence", W.fournisseurRecherche({ TAVILY_API_KEY: "t", BRAVE_API_KEY: "b" }).nom === "brave" && W.fournisseurRecherche({}) === null);
}

// ── rechercherSurLeWeb, avec un réseau simulé ────────────────────────────────
const tetesVues = [];
(async () => {
  const corps = (n) => ("<html><head><title>Page " + n + "</title></head><body><p>" + ("contenu de la page " + n + ". ").repeat(30) + "</p></body></html>");
  const reponses = {
    "fr.wikipedia.org/w/api.php": { json: { query: { pages: { 1: { title: "Énergie cinétique", canonicalurl: "https://fr.wikipedia.org/wiki/E", extract: "L'énergie cinétique est l'énergie d'un corps en mouvement, égale à la moitié de la masse fois le carré de la vitesse." } } } } },
    "fr.wikipedia.org/wiki/E": { html: corps("wiki") },
    "exemple.org/cours": { html: corps("cours") },
    "mort.org": { status: 404 },
    "interne/": { refused: true },
  };
  const appels = [];
  globalThis.fetch = async (u, init) => {
    appels.push(String(u));
    if (init && init.headers) tetesVues.push(init.headers);
    const cle = Object.keys(reponses).find((k) => String(u).includes(k));
    const r = cle ? reponses[cle] : null;
    if (!r || r.refused) throw new Error("ECONNREFUSED");
    return {
      ok: !r.status || r.status < 400,
      status: r.status || 200,
      url: String(u),
      async text() { return r.html ?? ""; },
      async json() { return r.json ?? {}; },
    };
  };

  const r1 = await W.rechercherSurLeWeb("énergie cinétique", { env: {}, lang: "fr" });
  nom("web: sans clé, la jambe encyclopédie répond", r1.pages.length === 1 && r1.pages[0].origine === "wikipedia", { n: r1.pages.length, origine: r1.pages[0]?.origine, titre: r1.pages[0]?.titre });
  nom("web: le texte cité est bien celui téléchargé", r1.pages[0].texte.includes("contenu de la page wiki"), r1.pages[0].texte.slice(0, 32));

  const r2 = await W.rechercherSurLeWeb("cours", { env: {}, urls: ["exemple.org/cours", "https://localhost:3000/x"] });
  nom("web: les URL collées passent en premier", r2.pages[0]?.origine === "collee", r2.pages.map((p) => p.origine));
  nom("web: une URL collée interdite est refusée ET dite", r2.avertissements.some((a) => /hôte réservé|port|privee/i.test(a)), r2.avertissements[0]);

  const r3 = await W.rechercherSurLeWeb("rien", { env: { BRAVE_API_KEY: "k" }, urls: [] });
  nom("web: une API de recherche qui ne répond pas est annoncée, pas masquée", r3.avertissements.some((a) => /brave/.test(a)), r3.avertissements.slice(0, 2));
  nom("web: brave tenté avant le repli", appels.some((u) => u.includes("api.search.brave.com")), appels.length + " appels");

  const r4 = await W.rechercherSurLeWeb("énergie", { env: {}, urls: ["mort.org"] });
  nom("web: page morte = avertissement, jamais un texte inventé", r4.avertissements.some((a) => /404|non lue/.test(a)), r4.avertissements[0]);

  const r5 = await W.rechercherSurLeWeb("", { env: {}, urls: [] });
  nom("web: sans question et sans URL, aucune page", r5.pages.length === 0 && /rien n.a pu/.test(r5.avertissements.join(" ")), r5.avertissements[0]);

  // Le moteur peut renvoyer deux fois la même page : elle ne doit être citée qu'une fois.
  const vusavant = await W.rechercherSurLeWeb("doublon", { env: {}, lang: "fr" });
  const compte = await (async () => {
    // on force deux candidats identiques en simulant une réponse d'API de recherche
    const sauvegarde = globalThis.fetch;
    let n = 0;
    globalThis.fetch = async (u) => {
      const s = String(u);
      if (s.includes("api.search.brave.com")) {
        return { ok: true, status: 200, url: s, async json() { return { web: { results: [
          { title: "Même page", url: "https://fr.wikipedia.org/wiki/E", description: "premier extrait" },
          { title: "Même page bis", url: "https://fr.wikipedia.org/wiki/E", description: "deuxième extrait" },
        ] } }; }, async text() { return ""; } };
      }
      n++;
      return sauvegarde(u);
    };
    const r = await W.rechercherSurLeWeb("énergie", { env: { BRAVE_API_KEY: "k" }, lang: "fr" });
    globalThis.fetch = sauvegarde;
    return { lus: n, pages: r.pages.map((p) => p.url), origines: r.pages.map((p) => p.origine) };
  })();
  nom("web: une même page n'est téléchargée et citée qu'une fois", new Set(compte.pages).size === compte.pages.length, { urls: compte.pages, lectures: compte.lus });
  nom("web: une API qui répond est utilisée (origine api)", compte.origines.some((o) => o === "api"), compte.origines);

  // Un en-tête non LATIN-1 fait lever fetch AVANT toute lecture : la page n'est
  // jamais téléchargée et l'élève ne voit qu'un extrait. Ce défaut s'est trouvé
  // tout seul (un « — » dans mon User-Agent), donc il est désormais vérifié ici.
  constLatin = /^[\t\x20-\x7E\xA0-\xFF]*$/;
  const entetes = tetesVues.flatMap((h) => Object.entries(h || {}));
  nom(
    "web: tout en-tête réellement passé à fetch tient dans un octet HTTP",
    entetes.length > 0 && entetes.every(([, v]) => constLatin.test(String(v))),
    { envoyes: entetes.length, fautives: entetes.filter(([, v]) => !constLatin.test(String(v))).map(([k]) => k) }
  );
  const sain = W.enTete("MoncefIA/1.0 (assistant scolaire — lecture d'une page demandée par l'élève)");
  nom("web: enTete() rend une chaîne utilisable en en-tête", constLatin.test(sain) && !sain.includes("—"), sain);

  console.log("\n   ═══ " + ok + " vérifications réussies, " + echecs.length + " échec(s) ═══");
  if (echecs.length) { for (const e of echecs) console.log("     - " + e); process.exit(1); }
})();
