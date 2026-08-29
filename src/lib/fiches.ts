/**
 * Découper un pavé collé en plusieurs fiches (lot B3).
 *
 * Le problème est réel et fréquent : l'élève reçoit un PDF de chapitre de 40 pages,
 * le colle d'un bloc, et se retrouve avec UNE source de 60 000 caractères. Or le reste
 * de Thunder raisonne par source : une seule source = un seul titre dans la liste, une
 * seule sélection pour le QCM, et un contexte qui sature.
 *
 * Ce fichier fait la moitié du travail SANS modèle, parce que cette moitié ne mérite
 * pas d'être payée ni d'être incertaine : trouver les titres, couper aux frontières de
 * paragraphe, garder les marqueurs `[p. N]` posés par `src/lib/extraire.ts` pour que
 * chaque fiche puisse encore dire « page 12 ». Le modèle, lui, ne fabrique que les
 * titres et les points clés — une seule fois pour toutes les fiches, pas un appel par
 * fiche (douze appels = douze fois le prix et douze fois l'occasion de se tromper).
 *
 * Rien ici n'invente de contenu : `validerFiches` jette toute fiche dont le titre est
 * vide, dont les points ne viennent pas d'un numéro de bloc demandé, ou dont le numéro
 * n'existe pas. Ce qui survit est ce qui est montré.
 */

/** Une fiche de 2 600 à 3 800 caractères : assez long pour un sous-chapitre, assez
 *  court pour tenir dans une réponse d'écran et dans un bloc de contexte de QCM. */
export const CIBLE_PAR_FICHE = 3200;
export const FICHES_MAX_PAR_APPEL = 12;
export const POINTS_MIN = 2;
export const POINTS_MAX = 4;

const TITRE_MAX = 90;
const POINT_MAX = 700;
/** Au-dessous, ce n'est pas une fiche, c'est une phrase : on la recolle à la précédente. */
const BLOC_MIN = 400;

export type Bloc = { index: number; titre: string | null; texte: string; pages: number[]; caractères: number };
export type Fiche = { fiche: number; titre: string; points: string[]; pages: number[] };

const LIGNE_TITRE = /^(#{1,6}\s+|(?:chapitre|section|le[çc]on|partie|unité|th[èe]me|cours)\b[\s:0-9ivxIVX.]*|(?:[IVXLC]{1,7}|[0-9]{1,2})[\.\)]\s+\S|\d{1,2}\.\d{1,2}\s+\S|t[đd]s?\s*[:\.]?\s+\S)/i;

export function normaliser(texte: string): string {
  return String(texte ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, "  ").replace(/ {3,}/g, "  ").trim();
}

/**
 * Deux forces de titre, parce que les deux erreurs coûtent cher :
 *  · FORT = le document le dit (`# Chapitre 2`, `Leçon 3`, `2.4`, `III.`). Il coupe,
 *    même si le bloc en cours est court : ignorer un titre explicite, c'est fusionner
 *    deux chapitres et perdre la moitié du découpage demandé.
 *  · FAIBLE = une ligne courte sans ponctuation finale, qui ressemble à un titre. Elle
 *    ne coupe qu'à partir d'un bloc déjà bien rempli : sinon un cours recopié à la main
 *    se morcelle en fiches de deux lignes.
 */
function classerLigne(ligne: string): { titre: string; fort: boolean } | null {
  const l = ligne.trim();
  if (!l || l.length > TITRE_MAX) return null;
  if (/^[-•*·]\s/.test(l)) return null; // une puce n'est pas un titre
  const fort = /^(#{1,6}\s+|(?:chapitre|section|le[çc]on|partie|unit[ée]|th[èe]me|cours)\b[\s:0-9ivxIVX.]*|(?:[IVXLC]{1,7}|[0-9]{1,2})[\.\)]\s+\S|\d{1,2}\.\d{1,2}\s+\S)/i.test(l);
  if (fort) return { titre: l.replace(/^#{1,6}\s*/, "").slice(0, TITRE_MAX), fort: true };
  if (/^[-•*·]\s/.test(l)) return null;
  if (/^[a-zàâçéèêëîïôûùü](?:[^.!?]{0,60})?[.!?]:?$/.test(l)) return null;
  // Ligne courte, sans ponctuation finale, qui commence par une majuscule : titre
  // probable dans un cours recopié à la main (le cas le plus courant ici).
  const faible = l.length <= 60 && !/[.!?,;:]$/.test(l) && /^(?:[A-ZÀ-ÖØ-Þ0-9])(?:[^a-z]{0,40}|[A-ZÀ-ÖØ-Þ0-9][a-zàÿçœ]{2,}(\s+\S+){0,6})$/.test(l);
  return faible ? { titre: l, fort: false } : null;
}

/** Les marqueurs de page laissés par l'extraction PDF : `[p. 12]` ou `[p. 12-13]`. */
export function pagesDans(texte: string): number[] {
  const vus = new Set<number>();
  const re = /\[p\.\s*(\d{1,4})(?:\s*-\s*(\d{1,4}))?\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texte))) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let p = a; p <= Math.min(b, a + 20); p++) vus.add(p);
  }
  return [...vus].sort((x, y) => x - y);
}

/**
 * Le découpage. Déterministe : mêmes entrées, mêmes fiches — c'est ce qui permet de le
 * tester sans réseau, et ce qui fait qu'un élève qui relance le même pavé récupère les
 * mêmes numéros de fiche (utile : les `source_id` des cartes de révision y accrochent).
 */
export function decouperTexte(texte: string, opts: { cible?: number; aPartirDe?: number } = {}): { blocs: Bloc[]; sautes: number; total: number; truncate: boolean } {
  const cible = Math.max(800, opts.cible ?? CIBLE_PAR_FICHE);
  const aPartirDe = Math.max(0, Math.round(Number(opts.aPartirDe ?? 0)));
  const brut = normaliser(texte);
  if (brut.length < BLOC_MIN) {
    return { blocs: brut ? [{ index: aPartirDe, titre: null, texte: brut, pages: pagesDans(brut), caractères: brut.length }] : [], sautes: 0, total: brut ? 1 : 0, truncate: false };
  }

  // 1) Découpe brute sur les lignes-titres.
  const lignes = brut.split("\n");
  const bruts: { titre: string | null; lignes: string[] }[] = [];
  let courant: { titre: string | null; lignes: string[] } = { titre: null, lignes: [] };
  let longueur = 0;
  for (const ligne of lignes) {
    const classe = classerLigne(ligne);
    if (classe && (classe.fort || longueur > cible * 0.55)) {
      if (courant.lignes.length) bruts.push(courant);
      courant = { titre: classe.titre, lignes: [] };
      longueur = 0;
      continue;
    }
    courant.lignes.push(ligne);
    longueur += ligne.length + 1;
    // Un bloc qui enfle sans titre trouvé : coupe aux paragraphes, pour ne pas rendre
    // une fiche de 30 000 caractères juste parce que le prof n'a pas mis de titres.
    if (longueur > cible * 1.6) {
      const texte = courant.lignes.join("\n");
      const morceaux = couperAuxParagraphes(texte, cible);
      morceaux.slice(0, -1).forEach((morceau) => bruts.push({ titre: courant.titre, lignes: [morceau] }));
      courant = { titre: null, lignes: [morceaux[morceaux.length - 1] ?? ""] };
      longueur = (courant.lignes[0] ?? "").length;
    }
  }
  if (courant.lignes.length) bruts.push(courant);

  // 2) Recollage des miettes, puis nettoyage.
  const colles: { titre: string | null; lignes: string[] }[] = [];
  for (const b of bruts) {
    const texte = normaliser(b.lignes.join("\n"));
    if (!texte) continue;
    if (texte.length < BLOC_MIN && colles.length) {
      const avant = colles[colles.length - 1]!;
      avant.lignes.push(b.titre ? `\n${b.titre}\n${texte}` : texte);
      avant.titre = avant.titre ?? b.titre;
      continue;
    }
    colles.push({ titre: b.titre, lignes: [texte] });
  }

  const blocsComplets: Bloc[] = colles
    .map((b, i) => {
      const texte = normaliser(b.lignes.join("\n"));
      return { index: i, titre: b.titre, texte, pages: pagesDans(texte), caractères: texte.length };
    })
    .filter((b) => b.texte.length > 0);

  const retenus = blocsComplets.slice(aPartirDe, aPartirDe + FICHES_MAX_PAR_APPEL);
  return {
    blocs: retenus.map((b, i) => ({ ...b, index: aPartirDe + i })),
    sautes: Math.max(0, blocsComplets.length - (aPartirDe + retenus.length)),
    total: blocsComplets.length,
    truncate: brut.length >= 60000,
  };
}

function couperAuxParagraphes(texte: string, cible: number): string[] {
  const paragraphes = texte.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const sortie: string[] = [];
  let courant = "";
  for (const p of paragraphes) {
    if (courant && courant.length + p.length + 2 > cible * 1.4) {
      sortie.push(courant);
      courant = p;
    } else {
      courant = courant ? `${courant}\n\n${p}` : p;
    }
    // Un seul paragraphe plus long que la cible : coupe franche au caractère le plus
    // proche d'une phrase, jamais au milieu d'un mot quand c'est évitable.
    while (courant.length > cible * 1.6) {
      const bord = courant.lastIndexOf(".", cible);
      const coupe = bord > cible * 0.5 ? bord + 1 : cible;
      sortie.push(courant.slice(0, coupe).trim());
      courant = courant.slice(coupe).trim();
    }
  }
  if (courant) sortie.push(courant);
  return sortie.length ? sortie : [texte];
}

/** Le JSON du modèle arrive entre du texte, avec des blocs de code, parfois tronqué :
 *  on prend le premier tableau équilibré, comme pour le QCM. */
export function extraireTableau(brut: string): unknown {
  const t = String(brut ?? "").replace(/^```(?:json)?/i, "").replace(/```$/m, "");
  const debut = t.indexOf("[");
  if (debut === -1) return null;
  let profondeur = 0;
  let dansChaine = false;
  let echappe = false;
  for (let i = debut; i < t.length; i++) {
    const c = t[i]!;
    if (dansChaine) {
      if (echappe) echappe = false;
      else if (c === "\\") echappe = true;
      else if (c === '"') dansChaine = false;
      continue;
    }
    if (c === '"') dansChaine = true;
    else if (c === "[") profondeur++;
    else if (c === "]") {
      profondeur--;
      if (profondeur === 0) {
        try {
          return JSON.parse(t.slice(debut, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Ce qui est accepté, et ce qui est jeté — dans cet ordre, avec un motif lisible :
 *  · un numéro de fiche qui ne correspond à aucun bloc envoyé → jeté (le modèle a
 *    inventé une fiche, ou s'est décalé) ;
 *  · zéro point, ou des points vides → jeté ;
 *  · un titre absent → on reprend le titre du bloc, et à défaut « Fiche n » (une fiche
 *    sans titre est une fiche qu'on ne retrouve pas dans la liste) ;
 *  · plus de 4 points → on garde les 4 premiers, sans prévenir le modèle deux fois.
 */
export function validerFiches(brut: string, blocs: Bloc[]): { ok: true; fiches: Fiche[]; jetees: { index: number; motif: string }[] } | { ok: false; motif: string } {
  const brutParse = extraireTableau(brut);
  if (!Array.isArray(brutParse) || brutParse.length === 0) {
    return { ok: false, motif: "aucun tableau JSON exploitable dans la réponse" };
  }
  const parIndex = new Map(blocs.map((b) => [b.index, b]));
  const vus = new Set<number>();
  const fiches: Fiche[] = [];
  const jetees: { index: number; motif: string }[] = [];
  for (const raw of brutParse) {
    const o = raw as Record<string, unknown>;
    const index = Number(o?.fiche ?? o?.index ?? o?.n);
    if (!Number.isFinite(index) || !parIndex.has(index)) {
      jetees.push({ index: Number.isFinite(index) ? index : -1, motif: "numéro de fiche qui ne correspond à aucun bloc envoyé" });
      continue;
    }
    if (vus.has(index)) {
      jetees.push({ index, motif: "fiche en double" });
      continue;
    }
    const bloc = parIndex.get(index)!;
    const titreBrut = String(o?.titre ?? "").trim();
    const titre = (titreBrut || bloc.titre || `Fiche ${index + 1}`).replace(/\s+/g, " ").slice(0, TITRE_MAX);
    const recus = Array.isArray(o?.points) ? o.points : Array.isArray(o?.buts) ? o.buts : [];
    const points = recus.map((p) => String(p ?? "").replace(/\s+/g, " ").trim()).filter((p) => p.length >= 12).slice(0, POINTS_MAX);
    if (points.length < POINTS_MIN) {
      jetees.push({ index, motif: `moins de ${POINTS_MIN} points clés exploitables` });
      continue;
    }
    vus.add(index);
    fiches.push({ fiche: index, titre, points: points.map((p) => p.slice(0, POINT_MAX)), pages: bloc.pages });
  }
  if (!fiches.length) return { ok: false, motif: `aucune fiche valide sur ${brutParse.length} objet(s) reçu(s) — ${jetees[0]?.motif ?? "motif inconnu"}` };
  return { ok: true, fiches, jetees };
}

/** Le texte stocké d'une fiche : le corps du bloc, pas le résumé. Le résumé sert à
 *  s'orienter ; ce qui doit rester interrogeable par le QCM, c'est l'original. */
export function texteFiche(bloc: Bloc, fiche?: Fiche): string {
  const entete = fiche ? [`# ${fiche.titre}`, fiche.points.map((p) => `• ${p}`).join("\n"), "\n—\n"] : [];
  return [...entete, bloc.texte].join("\n").slice(0, 60000);
}

export function consigneDecoupage(blocs: Bloc[]): string {
  const plan = blocs.map((b) => `[${b.index}] ${b.titre ? b.titre + " — " : ""}${b.caractères} caractères${b.pages.length ? ` (p. ${b.pages[0]}${b.pages.length > 1 ? "…" + b.pages[b.pages.length - 1] : ""})` : ""}`).join("\n");
  return (
    "Tu reçois un cours découpé en blocs numérotés. Pour CHAQUE bloc, renvoie un objet JSON : " +
    '{"fiche": <numéro du bloc>, "titre": "<titre court, au plus 8 mots>", "points": ["<2 à 4 points clés>", "..."]}.\n' +
    "Règles absolues : un point doit être compréhensible avec le seul texte du bloc ; n'ajoute AUCUNE information extérieure " +
    "au bloc, même si tu crois savoir ce que le cours aurait dû dire ; ne recopie pas une phrase entière plus longue que " +
    `${POINT_MAX} caractères ; garde l'orthographe et les notations du document, y compris les fautes probables — tu résumes, tu ne corriges pas. ` +
    "Réponds UNIQUEMENT par le tableau JSON, sans texte autour.\n\nBlocs :\n" +
    plan +
    "\n\nTexte des blocs :\n"
  );
}

/** Le texte tel que le modèle le reçoit : chaque bloc encadré de son numéro, parce que
 *  c'est le seul moyen pour lui de dire « ça vient du bloc 3 » et pour nous de vérifier. */
export function texteBlocs(blocs: Bloc[]): string {
  return blocs.map((b) => `--- [${b.index}] ${b.titre ?? "(sans titre)"} · ${b.caractères} caractères ---\n${b.texte}`).join("\n\n");
}
