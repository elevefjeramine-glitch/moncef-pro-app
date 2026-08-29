/**
 * La file de révision : mathématique pure, aucune donnée inventée.
 *
 * Un seul principe : une carte ne « vaut » rien tant qu'elle n'a pas été notée par
 * l'élève. Ici on ne calcule ni moyenne ni mérite — on calcule UNE DATE.
 *
 * Leitner à 6 boîtes, intervalles en jours : 1, 3, 7, 14, 30, 60.
 *   « encore »  → la carte retombe de deux boîtes (et `lapses` +1) : on a cru savoir ;
 *   « bien »    → +1 boîte ;
 *   « facile »  → +2 boîtes, mais jamais au-delà de la sixième (60 jours, pas un an).
 *
 * Ces nombres ne sont pas une vérité révélée : c'est le pas courant d'un Leitner
 * scolaire, choisi pour qu'un exam à 6 jours produise 2 ou 3 retours, pas 40.
 */

export const INTERVALLES_JOURS = [1, 3, 7, 14, 30, 60] as const;
export const DERNIERE_BOITE = INTERVALLES_JOURS.length;

export type Note = "encore" | "bien" | "facile";
export const NOTES: Note[] = ["encore", "bien", "facile"];

export function estNote(v: unknown): v is Note {
  return typeof v === "string" && (NOTES as string[]).includes(v);
}

/** Boîte suivante, bornée à [1 ; 6]. Une note inconnue ne déplace rien. */
export function boiteSuivante(boite: number, note: Note | string): number {
  const b = Math.min(DERNIERE_BOITE, Math.max(1, Math.trunc(Number(boite) || 1)));
  if (note === "encore") return Math.max(1, b - 2);
  if (note === "bien") return Math.min(DERNIERE_BOITE, b + 1);
  if (note === "facile") return Math.min(DERNIERE_BOITE, b + 2);
  return b;
}
/** Échéance en ISO (UTC), à partir de maintenant par défaut — une seule source d'heure. */
export function echeance(boite: number, depuis: Date = new Date()): string {
  const b = Math.min(DERNIERE_BOITE, Math.max(1, Math.trunc(Number(boite) || 1)));
  // Le `?? 60` n'est jamais lu : la boîte est bornée à [1 ; 6] juste au-dessus. Il est
  // là parce que `noUncheckedIndexedAccess` est actif dans ce projet et que le
  // compilateur ne prouve pas la validité de l'index — 60 est le dernier intervalle.
  const jours = INTERVALLES_JOURS[b - 1] ?? 60;
  return new Date(depuis.getTime() + jours * 86400000).toISOString();
}

/**
 * Empreinte courte de la question : empêche la même erreur de créer quatre cartes le
 * même soir. FNV-1a 64 bits en hexadécimal — déterministe, sans dépendance, et la
 * collision sur un jeu de fiches d'élève est négligeable devant le doublon certain.
 */
export function empreinte(texte: string): string {
  const propre = String(texte ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let h = 0xcbf29ce484222325n;
  for (const c of new TextEncoder().encode(propre)) {
    h ^= BigInt(c);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

/**
 * Série en cours, en jours UTC : on compte à rebours depuis aujourd'hui (ou depuis
 * hier si aujourd'hui n'est pas encore noté — un élève qui révise à 8 h du matin ne
 * doit pas voir sa série de 12 jours passer à 0 avant midi).
 */
export function serieActuelle(jours: string[], aujourdhui: string): number {
  const vus = new Set(jours.map((d) => String(d).slice(0, 10)));
  const hier = new Date(new Date(aujourdhui + "T00:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);
  let depart: string | null = vus.has(aujourdhui) ? aujourdhui : vus.has(hier) ? hier : null;
  if (!depart) return 0;
  let n = 0;
  let curseur = new Date(depart + "T00:00:00Z");
  while (vus.has(curseur.toISOString().slice(0, 10))) {
    n += 1;
    curseur = new Date(curseur.getTime() - 86400000);
  }
  return n;
}

/** Deux nombres que l'interface affiche tels quels — comptés, pas interprétés. */
export function compteSemaine(cartes: { created_at: string; lapses: number }[], depuisMs: number) {
  let creees = 0;
  let fragiles = 0;
  for (const c of cartes) {
    if (new Date(c.created_at).getTime() >= depuisMs) creees += 1;
    if (Number(c.lapses) >= 2) fragiles += 1;
  }
  return { creees, fragiles };
}
