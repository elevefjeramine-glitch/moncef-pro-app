/**
 * Le hors-ligne, décidé au seul endroit où on peut le prouver : la stratégie de cache.
 *
 * Un service worker est du JavaScript qu'aucun test ne peut lancer ici (pas de navigateur
 * dans ce bac à sable). Alors la règle du jeu : `public/sw-offline.js` ne CONTIENT aucune
 * décision — il appelle les mêmes helpers, écrits ici, et le test les juge. Ce qui est
 * vérifié en production par `tests/pwa-verif.py` : le fichier est servi, son type MIME, sa
 * portée, les URL préchargées qui répondent 200, et la présence des mêmes noms de cache
 * dans le fichier publié et dans ce module (dérive = test rouge).
 *
 * Un point de sécurité, parce que le site tourne sur des ordinateurs partagés au lycée :
 * les snapshots de cours sont rangés SOUS LA CLÉ DU COMPTE, et `cachesToWipe` les nomme
 * dès qu'un élève se déconnecte. Sans ça, le cahier d'un élève resterait lisible sur la
 * machine du suivant.
 */

export const NOMS_CACHES = {
  statique: "moncef-statique-v1",
  pages: "moncef-pages-v1",
  fiches: "moncef-fiches-v1",
} as const;

/** 20 fiches : un carrefour entre « utile dans le bus » et « ne pas transformer le
 *  téléphone en archive ». 7 jours : au-delà, une fiche de révision est fausse, pas utile. */
export const LIMITE_FICHES = 20;
export const DUREE_MAX_JOURS = 7;

/** Le noyau de ce qu'on précharge. Les URL de build (hashées) sont découvertes à la
 *  volée par la stratégie cache-first sur `/_next/static/**`, jamais listées ici : la
 *  liste serait fausse dès le déploiement suivant. */
export const URL_PRECHARGEES = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/sw-offline.js"] as const;

export type Genre = "fiches" | "cartes" | "devoirs";

export function cleSnapshot(uid: string, genre: Genre): string {
  return `${NOMS_CACHES.fiches}:${uid}:${genre}`;
}

/** Ce qu'il faut effacer quand un compte part. La clé du cache ET les pages mises en cache
 *  au vol, sinon l'élève précédent reste dans l'onglet du suivant. */
export function cachesAEffacer(uid: string | null): string[] {
  const socle = [NOMS_CACHES.statique, NOMS_CACHES.pages, NOMS_CACHES.fiches];
  if (!uid) return socle;
  return [...socle, ...(["fiches", "cartes", "devoirs"] as Genre[]).map((g) => cleSnapshot(uid, g))];
}

export type Decision = "reseau-puis-cache" | "cache-puis-reseau" | "reseau-seul";

/**
 * La table de décision, et son ordre n'est pas décoratif :
 *  · tout ce qui écrit (POST, PUT…) → jamais de cache, une réponse fantôme ferait croire
 *    à l'élève que son cours est parti ;
 *  · une navigation HTML → le réseau d'abord, le cache si le réseau manque ;
 *  · un asset hashé `/_next/static/**` → le cache d'abord (il est immuable par construction) ;
 *  · une API de données → le réseau d'abord, et le snapshot s'il n'y a rien.
 */
export function decider(methode: string, url: URL, memeOrigine: boolean): Decision {
  if (!memeOrigine) return "reseau-seul";
  if (methode !== "GET") return "reseau-seul";
  const chemin = url.pathname;
  if (chemin.startsWith("/api/")) return "reseau-puis-cache";
  if (chemin.startsWith("/_next/static/") || /\.(css|js|mjs|png|jpg|jpeg|svg|woff2?)$/.test(chemin)) return "cache-puis-reseau";
  if (url.origin && chemin) return "reseau-puis-cache";
  return "reseau-seul";
}

/** Le plus récent d'abord, et pas plus que la limite. Les entrées sont {garde:number,…}. */
export function trancher<T extends { garde: number }>(entrees: T[], maintenant: number, limite = LIMITE_FICHES): T[] {
  const fraiches = entrees.filter((e) => !estPerime(e.garde, maintenant));
  return fraiches.sort((a, b) => b.garde - a.garde).slice(0, limite);
}

export function estPerime(garde: number, maintenant: number, jours = DUREE_MAX_JOURS): boolean {
  return !Number.isFinite(garde) || maintenant - garde > jours * 86_400_000;
}

export type TextesBandeau = {
  hors_ligne: string;
  fiches: string;
  cartes: string;
  devoirs: string;
  gardes: string;
  rien_garde: string;
  rien_ne_part: string;
};

/** Le bandeau. Sobre, et il dit ce qui NE part PAS — c'est ça qui évite à l'élève de
 *  croire son travail envoyé. Les mots viennent de l'i18n (cinq langues) ; la grammaire
 *  de la phrase reste ici, donc testable. */
export function messageHorsLigne(comptes: { fiches: number; cartes: number; devoirs: number }, enLigne: boolean, txt: TextesBandeau): string {
  if (enLigne) return "";
  const total = comptes.fiches + comptes.cartes + comptes.devoirs;
  if (total === 0) return `${txt.hors_ligne} · ${txt.rien_garde}`;
  return `${txt.hors_ligne} · ${comptes.fiches} ${txt.fiches}, ${comptes.cartes} ${txt.cartes}, ${comptes.devoirs} ${txt.devoirs} ${txt.gardes} · ${txt.rien_ne_part}`;
}

/* ─────────────────────────────── côté navigateur ───────────────────────────────
 * Tout ce qui suit touche `navigator` et n'est donc pas jugé par les tests Node :
 * ce sont des tuyaux (postMessage, registration), pas des décisions. Les décisions
 * sont au-dessus, et elles sont testées.
 */

export function supporteServiceWorker(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/** Un seul enregistrement, au montage de la coquille applicative. Échouer ici n'est pas
 *  grave : le site marche sans le worker, il est juste muet hors-ligne. */
export async function demarrer(chemin = "/sw-offline.js"): Promise<ServiceWorkerRegistration | null> {
  if (!supporteServiceWorker() || typeof window === "undefined" || !window.isSecureContext) return null;
  try {
    return await navigator.serviceWorker.register(chemin, { scope: "/" });
  } catch {
    return null;
  }
}

export type Comptes = { fiches: number; cartes: number; devoirs: number; ageMinutes: number | null };

const VIDE: Comptes = { fiches: 0, cartes: 0, devoirs: 0, ageMinutes: null };

/** Envoie le snapshot au worker. `items` doit déjà être triée et tronquée (trancher) :
 *  c'est la page qui sait ce qu'est « les 20 derniers », le worker ne fait que stocker. */
export function envoyerSnapshot(uid: string, genre: Genre, items: { garde: number }[]): void {
  if (!supporteServiceWorker() || !uid) return;
  navigator.serviceWorker.ready
    .then((r) => r.active?.postMessage({ type: "snapshot", uid, genre, items }))
    .catch(() => {});
}

/** Combien de choses sont réellement lisibles sans réseau. Réponse du worker, avec un
 *  délai court : hors-ligne sans worker actif, on rend des zéros, pas un spinner. */
export async function lireComptes(uid: string, delaiMs = 1200): Promise<Comptes> {
  if (!supporteServiceWorker() || !uid) return VIDE;
  try {
    const reg = await navigator.serviceWorker.ready;
    const actif = reg.active;
    if (!actif) return VIDE;
    return await new Promise<Comptes>((resolve) => {
      const canal = new MessageChannel();
      let regle = false;
      const finir = (c: Comptes) => {
        if (regle) return;
        regle = true;
        resolve(c);
      };
      canal.port1.onmessage = (ev) => {
        const lignes = (ev.data?.lignes ?? []) as { genre: Genre; n: number; garde: number }[];
        const maintenant = Date.now();
        const g = (nom: Genre) => lignes.find((l) => l.genre === nom);
        const garde = Math.max(0, ...lignes.map((l) => l.garde));
        finir({
          fiches: g("fiches")?.n ?? 0,
          cartes: g("cartes")?.n ?? 0,
          devoirs: g("devoirs")?.n ?? 0,
          ageMinutes: garde ? (maintenant - garde) / 60000 : null,
        });
      };
      actif.postMessage({ type: "comptes", uid }, [canal.port2]);
      setTimeout(() => finir(VIDE), delaiMs);
    });
  } catch {
    return VIDE;
  }
}

/** À la déconnexion, sur un poste partagé au lycée : rien ne doit rester. */
export async function effacerSnapshots(uid: string | null): Promise<void> {
  if (!supporteServiceWorker()) return;
  for (const c of cachesAEffacer(uid)) {
    try {
      await caches.delete(c);
    } catch {
      /* un cache déjà fermé n'est pas une erreur de l'élève */
    }
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "wipe", uid });
  } catch {
    /* pas de worker actif : les caches viennent d'être supprimés à la main, c'est l'essentiel */
  }
}

/** Ce qu'on garde d'une liste de sources : assez pour réviser, pas de quoi faire peser
 *  40 Mo sur le téléphone d'un élève. L'extrait est tronqué à 1 200 caractères. */
export function snapshotFiches(sources: { id: string; titre: string; matiere?: string | null; longueur?: number }[], maintenant = Date.now()): { id: string; titre: string; matiere: string; longueur: number; garde: number }[] {
  return sources
    .slice(0, LIMITE_FICHES)
    .map((s) => ({ id: s.id, titre: String(s.titre ?? "").slice(0, 200), matiere: String(s.matiere ?? "").slice(0, 80), longueur: Number(s.longueur ?? 0), garde: maintenant }));
}

/** Ligne de stats pour le rail : ce qui est réellement lisible sans réseau. */
export function ligneStats(comptes: { fiches: number; cartes: number; devoirs: number }, ageMinutes: number | null): string {
  const age = ageMinutes === null ? "" : ageMinutes < 60 ? `, dernière synchro il y a ${Math.max(1, Math.round(ageMinutes))} min` : `, dernière synchro il y a ${Math.round(ageMinutes / 60)} h`;
  return `${comptes.fiches} fiches hors-ligne${age}`;
}

/** Faut-il proposer l'installation (banner PWA) ? Le navigateur doit le demander, et il
 *  ne faut pas l'avoir déjà refusée trois fois. */
export function proposerInstallation(evenementDeclenche: boolean, dejaInstalle: boolean, refusRecents: number): boolean {
  return evenementDeclenche && !dejaInstalle && refusRecents < 3;
}
