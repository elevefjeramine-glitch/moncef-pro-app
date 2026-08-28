import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Garde-fous sur la taille du corps des requêtes.
//
// POURQUOI CE FICHIER EXISTE
// Avant lui, aucune route ne regardait la taille de ce qu'on lui envoyait :
// `await req.json()` bufferise tout en mémoire. La seule limite réellement
// appliquée était celle de la plateforme — 6 Mo par requête pour une fonction
// Netlify, et 4,5 Mo effectifs pour une charge binaire à cause de l'encodage
// base64 (source : docs.netlify.com/build/functions/overview, « 6 MB request and
// response payload size limit for buffered synchronous functions », « Lower
// effective limit for binary request payloads … 4.5 MB »). Au-delà, la
// connexion est coupée côté plateforme : le client ne reçoit ni code ni message,
// seulement une erreur réseau.
//
// Ce que ça change ici, mesuré dans le dépôt :
//  - les trois routes d'import et le panneau Alpha ne reçoivent que des tableaux
//    d'objets courts : 1 Mo est très au-dessus de ce que produit l'application
//    (un import de 400 devoirs pèse de l'ordre de 60 Ko) ;
//  - /api/chat peut transporte une image, et c'est le seul endroit où le plafond
//    doit être haut : src/app/app/ai/page.tsx fait `reader.readAsDataURL(file)`
//    sans redimensionner ni compresser, donc la photo part telle quelle, gonflée
//    d'environ 4/3 par le base64. Un plafond trop bas casserait l'analyse d'image.
//
// Ce que ce fichier NE FAIT PAS, et c'est assumé : il ne limite pas le nombre de
// requêtes par compte (pas de rate limit). Un élève motivé peut envoyer 5 Mo,
// autant de fois qu'il veut, exactement comme avant.
// ─────────────────────────────────────────────────────────────────────────────

const KO = 1024;
const MO = 1024 * 1024;

export const LIMITE_CORPS = {
  /** /api/chat : texte + éventuellement une image en base64, non compressée côté client. */
  chat: 5 * MO,
  /** entries des trois routes d'import, et actions du panneau Alpha. */
  import: 1 * MO,
  alpha: 1 * MO,
  /** { confirm: true } ou { cancel: true } : quelques dizaines d'octets. */
  compte: 64 * KO,
} as const;

export class CorpsTropVolumineux extends Error {
  readonly limiteOctets: number;
  readonly recuOctets: number;
  /** true si on l'a su par l'en-tête Content-Length, false si découvert en lisant. */
  readonly depuisEntete: boolean;

  constructor(recu: number, max: number, depuisEntete: boolean) {
    super(`corps de ${recu} octets refusé, maximum ${max}`);
    this.name = 'CorpsTropVolumineux';
    this.recuOctets = recu;
    this.limiteOctets = max;
    this.depuisEntete = depuisEntete;
  }
}

function octetsVersTexte(n: number): string {
  if (n >= MO) return `${(n / MO).toFixed(n % MO === 0 ? 0 : 1)} Mo`;
  return `${(n / KO).toFixed(n % KO === 0 ? 0 : 1)} Ko`;
}

function tailleAnnoncee(req: Request): number | null {
  const brut = req.headers.get('content-length');
  if (brut === null) return null;
  const n = Number(brut);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Refus sur la seule taille annoncée, sans toucher au corps. À appeler avant
 * l'authentification : un payload démesuré ne doit faire ni lire un jeton, ni
 * interroger la base, ni bufferiser quoi que ce soit.
 * Renvoie null si la taille est absente de l'en-tête ou acceptable — dans ce cas
 * `lireJson` fera le travail pendant la lecture.
 */
export function rejeterSiAnnonceTropGrosse(
  req: Request,
  max: number,
  aide?: string,
): NextResponse | null {
  const annonce = tailleAnnoncee(req);
  if (annonce === null || annonce <= max) return null;
  return reponseTropVolumineux(new CorpsTropVolumineux(annonce, max, true), aide);
}

/**
 * Lit le corps en comptant les octets, et retourne le JSON parsé.
 * L'en-tête Content-Length n'est pas une vérité : un client peut annoncer 10 octets
 * et écrire 10 Mo. D'où le comptage pendant la lecture, qui avorte dès que la
 * limite est franchie.
 * Lève `CorpsTropVolumineux` si c'est trop gros, `SyntaxError` si ce n'est pas du JSON.
 */
export async function lireJson(req: Request, max: number): Promise<any> {
  const annonce = tailleAnnoncee(req);
  if (annonce !== null && annonce > max) {
    throw new CorpsTropVolumineux(annonce, max, true);
  }
  if (!req.body) return {};

  const lecteur = req.body.getReader();
  const decodeur = new TextDecoder('utf-8');
  let recus = 0;
  let texte = '';
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    if (!value) continue;
    recus += value.byteLength;
    if (recus > max) {
      // On lâche le flux au lieu de le vider : c'est tout l'intérêt du plafond.
      await lecteur.cancel().catch(() => undefined);
      throw new CorpsTropVolumineux(recus, max, false);
    }
    // stream: true pour ne pas casser un caractère multi-octets à cheval sur deux morceaux.
    texte += decodeur.decode(value, { stream: true });
  }
  texte += decodeur.decode();
  if (texte.trim() === '') return {};
  return JSON.parse(texte);
}

/** Réponse 413 normalisée, à renvoyer telle quelle depuis un catch. */
export function reponseTropVolumineux(e: unknown, aide?: string): NextResponse | null {
  if (!(e instanceof CorpsTropVolumineux)) return null;
  const details: Record<string, unknown> = {
    error:
      `Corps de requête trop volumineux : ${octetsVersTexte(e.limiteOctets)} maximum ` +
      `(${e.limiteOctets} octets), reçu ${e.recuOctets} octets${e.depuisEntete ? ' annoncés' : ' à la lecture'}.`,
    limite_octets: e.limiteOctets,
    recu_octets: e.recuOctets,
    mesure: e.depuisEntete ? 'en-tête Content-Length' : 'octets lus avant avortement',
  };
  if (aide) details.aide = aide;
  return NextResponse.json(details, {
    status: 413,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * À mettre dans le `catch` déjà présent de chaque route : transforme le refus de
 * taille en 413, et laisse passer toute autre erreur vers le traitement existant.
 */
export function reponse413(e: unknown, aide?: string): NextResponse | null {
  return reponseTropVolumineux(e, aide);
}
