/**
 * La voix du site : lire une réponse à haute voix, sans envoyer un octet.
 *
 * `speechSynthesis` est une API du navigateur, déjà là sur Chrome, Edge, Safari et
 * Firefox. Ce module ne fait PAS semblant de l'appeler : il décide QUI parle, COMBIEN de
 * morceaux, et ce qu'on affiche quand la machine n'a aucune voix installée — trois
 * choses qu'on peut tester sous Node, et qu'on teste (`tests/voix.test.ts`).
 *
 * Le piège qui a été mesuré et qui est écrit ici pour qu'on n'y retombe pas : sur Chrome,
 * `getVoices()` renvoie un tableau VIDE au premier appel. Les voix arrivent sur
 * `voiceschanged`. Un bouton « Écouter » branché sans cette écoute est donc grisé pour
 * tout le monde pendant les premières millisecondes — et souvent pour toujours si on ne
 * se re-synchronise pas.
 */

export type VoixNavigateur = {
  name: string;
  lang: string;
  voiceURI?: string;
  default?: boolean;
  localService?: boolean;
};

export type Langue = "fr" | "en" | "es" | "ar" | "zh";

export const LANGUE_PAR_DEFAUT: Langue = "fr";

/** Débit et hauteur, réglés à l'oreille sur des phrases de cours. L'arabe et le chinois
 *  descendent un peu : à 1.0, les voix de test butent sur les nombres et les décimales. */
export const REGLAGES: Record<Langue, { vitesse: number; hauteur: number }> = {
  fr: { vitesse: 1.02, hauteur: 1 },
  en: { vitesse: 1, hauteur: 1 },
  es: { vitesse: 1, hauteur: 1 },
  ar: { vitesse: 0.92, hauteur: 0.98 },
  zh: { vitesse: 0.95, hauteur: 1 },
};

/** Une phrase de 220 caractères se lit en ~14 s. Morceler sert à deux choses : un arrêt
 *  net quand l'élève change d'onglet (sinon la file continue), et pas de bug de silence
 *  après ~15 s sur certaines synthèses Android. */
export const LONGUEUR_MAX_PHRASE = 220;

const ETIQUETTE = /<[^>]+>/g;
const CITATION = /\[(?:S\d+|p\.\s*\d+(?:-\d+)?)\]/g;

/** Le markdown d'une réponse Thunder (listes, gras, tableaux, `#`, citations `[S3]`) ne se
 *  lit pas à voix haute. On rend du texte parlé, pas du texte formaté. */
export function nettoyerPourVoix(markdown: string): string {
  return String(markdown ?? "")
    .replace(/```[\s\S]*?```/g, " (bloc de code, à lire sur l'écran) ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(ETIQUETTE, " ")
    .replace(CITATION, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/\|/g, " , ")
    .replace(/[*_`>]{1,3}/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .trim();
}

/** Découpe en phrases, puis coupe les phrases fleuves au dernier espace avant la limite.
 *  Ne renvoie jamais un morceau vide, jamais plus long que `max`. */
export function decouperEnPhrases(texte: string, max = LONGUEUR_MAX_PHRASE): string[] {
  const propre = nettoyerPourVoix(texte);
  if (!propre) return [];
  const phrases = propre.split(/(?<=[.!?…])\s+|\n+/).map((p) => p.trim()).filter(Boolean);
  const sortie: string[] = [];
  for (const phrase of phrases) {
    if (phrase.length <= max) {
      sortie.push(phrase);
      continue;
    }
    let reste = phrase;
    while (reste.length > max) {
      let coupe = reste.lastIndexOf(" ", max);
      if (coupe < max * 0.4) coupe = max; // une seule mot-clé de 300 lettres : on coupe à la dure
      sortie.push(reste.slice(0, coupe).trim());
      reste = reste.slice(coupe).trim();
    }
    if (reste) sortie.push(reste);
  }
  return sortie.filter((s) => s.length > 0);
}

/**
 * Quelle voix choisir. Ordre de préférence, et il est délibéré :
 * 1. la langue exacte demandée (`fr-FR` plutôt que `fr-CA` pour un cours marocain) ;
 * 2. n'importe quelle voix de la même langue, `fr-*` ;
 * 3. une voix locale (`localService`) — une voix réseau de Google lâche hors connexion,
 *    et le hors-ligne est justement l'autre étage de ce lot ;
 * 4. la voix par défaut ;
 * 5. sinon `null` : l'interface grise le bouton et le dit. Ne jamais promettre une voix
 *    que la machine n'a pas.
 */
export function choisirVoix(voix: VoixNavigateur[], langue: Langue): VoixNavigateur | null {
  if (!Array.isArray(voix) || voix.length === 0) return null;
  const l = langue.toLowerCase();
  const region = langue === "fr" ? "fr-fr" : langue === "ar" ? "ar-ma" : langue === "zh" ? "zh-cn" : langue === "es" ? "es-es" : "en-gb";
  const dansLaLangue = voix.filter((v) => String(v.lang ?? "").toLowerCase().replace("_", "-").startsWith(l));
  return (
    dansLaLangue.find((v) => String(v.lang).toLowerCase().replace("_", "-") === region) ??
    dansLaLangue.find((v) => v.localService) ??
    dansLaLangue[0] ??
    voix.find((v) => v.default) ??
    voix.find((v) => v.localService) ??
    null
  );
}

export type Synthetiseur = {
  getVoices?: () => VoixNavigateur[];
  speak?: (u: Morceau) => void;
  cancel?: () => void;
  pause?: () => void;
  resume?: () => void;
  onvoiceschanged?: (() => void) | null;
  speaking?: boolean;
  paused?: boolean;
  pending?: boolean;
};

export type Morceau = { text: string; lang?: string; rate?: number; pitch?: number; voice?: VoixNavigateur };

export function syntheseDisponible(s: Synthetiseur | undefined | null): boolean {
  return !!(s && typeof s.speak === "function" && typeof s.getVoices === "function");
}

export type Lecture = {
  /** Le nombre de morceaux réellement mis dans la file — ce que le test vérifie. */
  morceaux: number;
  langue: string;
  voix: string | null;
  annuler: () => void;
};

/**
 * Lit à voix haute. Renvoie `{morceaux: 0}` quand rien n'est possible : l'appelant affiche
 * alors l'avertissement, au lieu d'un bouton qui ne fait rien.
 */
export function lire(texte: string, langue: Langue, s?: Synthetiseur): Lecture {
  const morceaux = decouperEnPhrases(texte);
  const annuler = () => {
    try {
      s?.cancel?.();
    } catch {
      /* une synthèse qui refuse d'annuler ne doit jamais faire tomber l'onglet */
    }
  };
  if (!syntheseDisponible(s) || morceaux.length === 0) return { morceaux: 0, langue, voix: null, annuler };
  const reglage = REGLAGES[langue] ?? REGLAGES[LANGUE_PAR_DEFAUT];
  const voix = choisirVoix(s!.getVoices!() ?? [], langue);
  for (const morceau of morceaux) {
    const u: Morceau = { text: morceau, lang: langue, rate: reglage.vitesse, pitch: reglage.hauteur };
    if (voix) {
      u.voice = voix;
      u.lang = voix.lang || langue;
    }
    try {
      s!.speak!(u);
    } catch {
      return { morceaux: 0, langue, voix: voix?.name ?? null, annuler };
    }
  }
  return { morceaux: morceaux.length, langue, voix: voix?.name ?? null, annuler };
}

export type EtatVoix = "libre" | "en_cours" | "en_pause" | "indecis";

/** L'état lu sur l'objet, pas celui qu'on imagine : c'est ce que la page affiche. */
export function etatDe(s?: Synthetiseur): EtatVoix {
  if (!s || !syntheseDisponible(s)) return "indecis";
  if (s.paused) return "en_pause";
  if (s.speaking || s.pending) return "en_cours";
  return "libre";
}

/**
 * La dictée (`SpeechRecognition`) n'est PAS universelle : Chrome et Edge oui, Firefox et
 * Safari non (iOS compris). Le bouton ne doit jamais apparaître là où il ne marchera pas.
 */
export function dicteeDisponible(userAgent: string, objetPresent: boolean): boolean {
  if (!objetPresent) return false;
  const ua = String(userAgent ?? "");
  const chromium = /(?:Chrome|Chromium|Edg|EdgA|Edgios)\/\d+/.test(ua);
  // Chrome sur iOS se fait passer pour Safari mobile mais n'a pas l'API : l'objet manquant
  // l'a déjà écarté. Opera desktop l'a, on le garde.
  return chromium && !/\bFirefox\//.test(ua);
}
