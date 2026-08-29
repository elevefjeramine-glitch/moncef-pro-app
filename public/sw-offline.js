/* Service worker du mode hors-ligne.
 *
 * Il ne prend AUCUNE décision de politique ici : les noms de cache, la limite de fiches,
 * la durée de vie et la table « qui passe par le réseau » sont écrits dans
 * `src/lib/hors-ligne.ts`, testés sous Node, et revérifiés contre ce fichier par
 * `tests/pwa-verif.py` (dérive = test rouge). Ce fichier-ci n'applique que des règles.
 *
 * Trois principes, dans l'ordre :
 *  1 · RIEN n'est mis en cache sur une écriture (POST, PUT…) — une réponse fantôme
 *      ferait croire à l'élève que son cours est enregistré ;
 *  2 · les fiches sont rangées SOUS LA CLÉ DU COMPTE, et effacées à la déconnexion :
 *      un poste du lycée est partagé, pas personnel ;
 *  3 · une API injoignable répond 503 en JSON, pas une page HTML : l'app peut continuer
 *      à afficher son snapshot au lieu de ramer sur du texte.
 */
const CACHE_STATIQUE = "moncef-statique-v1";
const CACHE_PAGES = "moncef-pages-v1";
const CACHE_FICHES = "moncef-fiches-v1";
const PRECHARGE = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/"];
const NOTRE_FAMILLE = ["moncef-statique-", "moncef-pages-", "moncef-fiches-"];

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches
      .open(CACHE_STATIQUE)
      .then((cache) => Promise.all(PRECHARGE.map((u) => cache.add(new Request(u, { cache: "reload" })).catch(() => undefined))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      // Un cache dont le préfixe n'est pas des nôtres appartient à autre chose : on n'y
      // touche pas. Un cache « moncef-* » d'une version antérieure, si.
      .then((cles) => Promise.all(cles.filter((k) => NOTRE_FAMILLE.some((p) => k.startsWith(p)) && ![CACHE_STATIQUE, CACHE_PAGES, CACHE_FICHES].some((n) => k === n || k.startsWith(n + ":"))).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function estAssetHash(url) {
  return url.pathname.startsWith("/_next/static/") || /\.(css|js|mjs|png|jpg|jpeg|svg|woff2?)$/.test(url.pathname);
}
function estApi(url) {
  return url.pathname.startsWith("/api/");
}

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  if (requete.method !== "GET") return; // règle 1 : jamais de cache sur une écriture
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return; // aucune mise en cache hors de l'origine

  if (estApi(url)) {
    evenement.respondWith(
      fetch(requete).catch(() => new Response(JSON.stringify({ error: "Hors-ligne : la requête n'est pas partie.", hors_ligne: true, cout: 0 }), { status: 503, headers: { "content-type": "application/json" } }))
    );
    return;
  }

  if (estAssetHash(url)) {
    evenement.respondWith(caches.match(requete).then((garde) => garde || fetch(requete).then((reponse) => caches.open(CACHE_STATIQUE).then((cache) => void cache.put(requete, reponse.clone())).then(() => reponse))));
    return;
  }

  // Les pages : le réseau d'abord (un cours modifié doit être visible), le cache sinon.
  evenement.respondWith(
    fetch(requete)
      .then((reponse) => {
        if (reponse.ok && reponse.type === "basic") {
          const magasin = url.pathname.startsWith("/app") ? CACHE_PAGES : CACHE_STATIQUE;
          evenement.waitUntil(caches.open(magasin).then((cache) => cache.put(requete, reponse.clone())));
        }
        return reponse;
      })
      .catch(() =>
        caches
          .match(requete)
          .then((garde) => garde || caches.match("/"))
          .then((garde) => garde || new Response("<!doctype html><meta charset=utf-8><title>Moncef IA — hors-ligne</title><body style=\"font:16px/1.6 system-ui;background:#0b1f13;color:#eafff4;padding:9vh 8vw\"><h1 style=\"font-size:22px\">Le réseau manque</h1><p>Les fiches gardées sur cet appareil restent lisibles. Tout ce qui demande l'IA est en attente : rien n'est parti.</p>", { headers: { "content-type": "text/html; charset=utf-8" }, status: 503 }))
      )
  );
});

self.addEventListener("message", (evenement) => {
  const d = evenement.data || {};
  if (d.type === "snapshot") {
    // Le tri et la limite de 20 sont déjà appliqués par l'appelant (hors-ligne.ts) :
    // le worker stocke, il ne décide pas.
    const cle = `${CACHE_FICHES}:${d.uid}:${d.genre}`;
    caches
      .open(CACHE_FICHES)
      .then((cache) => cache.put(new Request("snap://" + d.uid + "/" + d.genre), new Response(JSON.stringify(d.items ?? []), { headers: { "content-type": "application/json", "x-garde": String(Date.now()) } })))
      .then(() => evenement.source && evenement.source.postMessage({ type: "snapshot-ok", genre: d.genre, nombre: (d.items || []).length }));
    return;
  }
  if (d.type === "comptes") {
    caches
      .open(CACHE_FICHES)
      .then((cache) => Promise.all(["fiches", "cartes", "devoirs"].map((g) => cache.match(new Request("snap://" + d.uid + "/" + g)).then((r) => (r ? r.json().then((j) => ({ genre: g, n: (j || []).length, garde: Number(r.headers.get("x-garde") || 0) })) : { genre: g, n: 0, garde: 0 })))))
      .then((lignes) => evenement.source && evenement.source.postMessage({ type: "comptes", lignes }));
    return;
  }
  if (d.type === "wipe") {
    // Déconnexion : tout ce qui porte le sceau du site part, y compris les pages HTML.
    const cles = d.uid ? [CACHE_STATIQUE, CACHE_PAGES, CACHE_FICHES, `${CACHE_FICHES}:${d.uid}:fiches`, `${CACHE_FICHES}:${d.uid}:cartes`, `${CACHE_FICHES}:${d.uid}:devoirs`] : [CACHE_STATIQUE, CACHE_PAGES, CACHE_FICHES];
    Promise.all(cles.map((c) => (c === CACHE_FICHES ? caches.keys().then((toutes) => Promise.all(toutes.filter((k) => k.startsWith(CACHE_FICHES + ":")).map((k) => caches.delete(k)))) : caches.delete(c)))).then(
      () => evenement.source && evenement.source.postMessage({ type: "wipe-ok" })
    );
  }
});
