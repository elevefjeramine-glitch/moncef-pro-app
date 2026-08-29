/**
 * Le plan de révision (lot C4) : « ce soir, je fais quoi ? » — en sept lignes lues,
 * sans appeler un modèle, donc sans consommer un crédit.
 *
 * Ce que la file Leitra sait déjà faire : dire QUAND une carte revient. Ce qu'elle ne
 * dit pas : dans quel ORDER les traiter quand il y en a quarante de retard, et combien
 * de temps ça va prendre. C'est tout l'intérêt du calcul — et il tient dans une
 * fonction, pas dans une génération de texte.
 *
 * Le coût par carte (40 secondes) est une ESTIMATION, pas une mesure : c'est ce que
 * j'ai retenu pour qu'une soirée de 45 minutes tienne debout (≈ 65 cartes), et il est
 * exposé (`minutes_par_carte`) pour qu'on puisse le discuter plutôt que le subir.
 * Il n'y a aucun historique d'usage sur ce compte pour l'ajuster : le dire fait partie
 * de la fonction.
 */

export const MINUTES_PAR_CARTE = 2 / 3; // 40 s
export const BLOC_MAX_CARTES = 12;
export const BLOCS_MAX_PAR_JOUR = 4;

export type CartePlan = {
  id: string;
  question: string | null;
  matiere?: string | null;
  boite?: number | null;
  due_at?: string | null;
  reps?: number | null;
  lapses?: number | null;
};

export type Bloc = { matiere: string; cartes: { id: string; question: string; retard_jours: number; boite: number }[]; minutes: number };
export type Journee = { jour: string; libelle: string; minutes: number; blocs: Bloc[]; en_retard: number; avance: boolean; deborde: number };
export type Plan = { journees: Journee[]; total_cartes: number; minutes_par_carte: number; sature: boolean; retard_total_minutes: number; message: string };

const HEURE = 3600000;

function cleJour(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function libelleJour(jour: string, aujourdhui: string): string {
  const d = new Date(jour + "T00:00:00Z").getTime();
  const a = new Date(aujourdhui + "T00:00:00Z").getTime();
  const n = Math.round((d - a) / 86400000);
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return "Demain";
  if (n === -1) return "Hier";
  if (n > 1 && n < 7) return new Date(jour + "T00:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  return jour;
}

/** Le rang. Trois termes, dans cet ordre, et chacun a une raison :
 *  · le RETARD d'abord (une carte due depuis quatre jours n'attend pas : son souvenir
 *    est déjà à moitié parti, et c'est le seul signal qui coûte quelque chose) ;
 *  · la BOÎTE ensuite (à retard égal, on reprend la plus fragile : 0 = revue hier,
 *    4 = revue il y a un mois — remonter la boîte, c'est relire ce qui tient mal) ;
 *  · les LAPSES en dernier, plafonnés à 3 (au-delà, une carte n'est pas « trois fois
 *    plus » fragile, elle est probablement mal écrite : le plafond évite qu'une seule
 *    question ratée cinq fois absorbe toute la soirée). */
export function rang(c: CartePlan, maintenant: number): number {
  const due = c.due_at ? new Date(c.due_at).getTime() : maintenant;
  const retard = Math.max(0, (maintenant - due) / 86400000);
  const boite = Number.isFinite(Number(c.boite)) ? Number(c.boite) : 0;
  const lapses = Math.min(3, Number(c.lapses ?? 0));
  return retard * 10 + (5 - Math.min(5, Math.max(0, boite))) + lapses * 2 + Math.min(1, Number(c.reps ?? 0) / 10) * 0.1;
}

export function retardEnJours(c: CartePlan, maintenant: number): number {
  if (!c.due_at) return 0;
  return Math.max(0, Math.round((maintenant - new Date(c.due_at).getTime()) / 86400000));
}

/** Les cartes sont groupées par MATIÈRE à l'intérieur d'une journée : relire douze
 *  fiches de physique d'affilée, ce n'est pas la même chose que douze fiches mélangées.
 *  (Le mélange, lui, est déjà dans la file Leitra — les boîtes ne trient pas par
 *  matière. Les deux se complètent, et c'est pour ça que le tri est ici stable.) */
export function construirePlan(cartes: CartePlan[], opts: { maintenant?: Date; budgetMinutes?: number; horizonJours?: number } = {}): Plan {
  const maintenantMs = (opts.maintenant ?? new Date()).getTime();
  const budget = Math.max(5, Math.min(240, Math.round(opts.budgetMinutes ?? 45)));
  const horizon = Math.max(1, Math.min(21, Math.round(opts.horizonJours ?? 7)));
  const aujourdhui = cleJour(maintenantMs);
  const liste = (cartes ?? []).filter((c) => c && c.id);

  const retardees = liste.filter((c) => (c.due_at ? new Date(c.due_at).getTime() : maintenantMs) <= maintenantMs + HEURE);
  const aVenir = liste.filter((c) => (c.due_at ? new Date(c.due_at).getTime() : maintenantMs) > maintenantMs + HEURE);
  const tous = [...retardees, ...aVenir].sort((a, b) => rang(b, maintenantMs) - rang(a, maintenantMs));

  // Chaque carte sait si elle est DUE ce jour-là ou si elle y a été REPORTÉE : c'est
  // ce qui permet de dire « cette soirée, tu l'avances » au lieu d'un chiffre brut.
  type File = { carte: CartePlan; dueCeJour: boolean };
  const parJour = new Map<string, File[]>();
  let quantaAujourdhui = 0;
  const capaciteAujourdhui = Math.floor(budget / MINUTES_PAR_CARTE);

  for (const c of tous) {
    const dueMs = c.due_at ? new Date(c.due_at).getTime() : maintenantMs;
    let jour = cleJour(Math.max(dueMs, maintenantMs));
    if (jour > cleJour(maintenantMs + horizon * 86400000)) continue; // hors horizon : pas dans ce plan
    if (jour === aujourdhui) {
      if (quantaAujourdhui >= capaciteAujourdhui) {
        // Ça déborde : on reporte au lendemain, jamais « plus tard dans la semaine »
        // (un report de trois jours sur une carte déjà en retard, c'est une carte perdue).
        jour = cleJour(maintenantMs + 86400000);
      } else quantaAujourdhui++;
    }
    const file = parJour.get(jour) ?? [];
    if (file.length < capaciteAujourdhui * 2) file.push({ carte: c, dueCeJour: jour === cleJour(Math.max(dueMs, maintenantMs)) });
    parJour.set(jour, file);
  }

  const journees: Journee[] = [];
  for (let i = 0; i <= horizon; i++) {
    const jour = cleJour(maintenantMs + i * 86400000);
    const recues = parJour.get(jour) ?? [];
    if (!recues.length) continue;
    const avancees = recues.filter((f) => !f.dueCeJour).length;
    const parMatiere = new Map<string, CartePlan[]>();
    for (const { carte: c } of recues) {
      const m = String(c.matiere ?? "Autre").trim() || "Autre";
      const file = parMatiere.get(m) ?? [];
      if (file.length < BLOCS_MAX_PAR_JOUR * BLOC_MAX_CARTES) file.push(c);
      parMatiere.set(m, file);
    }
    // Une matière qui dépasse 12 cartes occupe PLUSIEURS blocs de la même journée :
    // plafonner à 12 par bloc doit rester une règle de lisibilité, pas un quota qui
    // vide le budget promis (« 45 minutes » avec 12 cartes affichées serait un mensonge).
    const groupes = [...parMatiere.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .flatMap(([matiere, cs]) => {
        const morceaux: CartePlan[][] = [];
        for (let i = 0; i < cs.length; i += BLOC_MAX_CARTES) morceaux.push(cs.slice(i, i + BLOC_MAX_CARTES));
        return morceaux.map((morceau, k) => [`${matiere}${morceaux.length > 1 ? ` (${k + 1}/${morceaux.length})` : ""}`, morceau] as [string, CartePlan[]]);
      })
      .slice(0, BLOCS_MAX_PAR_JOUR);
    const blocs: Bloc[] = groupes.map(([matiere, cs]) => ({
      matiere,
      minutes: Math.max(1, Math.round(cs.length * MINUTES_PAR_CARTE)),
      cartes: cs.map((c) => ({
        id: c.id,
        question: String(c.question ?? "").slice(0, 160),
        retard_jours: retardEnJours(c, maintenantMs),
        boite: Number(c.boite ?? 0),
      })),
    }));
    const nb = blocs.reduce((a, b) => a + b.cartes.length, 0);
    const enRetard = blocs.reduce((a, b) => a + b.cartes.filter((c) => c.retard_jours > 0).length, 0);
    journees.push({
      jour,
      libelle: libelleJour(jour, aujourdhui),
      minutes: Math.max(1, Math.round(nb * MINUTES_PAR_CARTE)),
      blocs,
      en_retard: enRetard,
      avance: jour !== aujourdhui && avancees > 0,
      deborde: Math.max(0, (parJour.get(jour)?.length ?? 0) - nb),
    });
  }

  const totalMinutes = journees.reduce((a, j) => a + j.minutes, 0);
  const retardTotal = Math.round(retardees.length * MINUTES_PAR_CARTE);
  const sature = retardees.length > capaciteAujourdhui;
  const message = !liste.length
    ? "Aucune carte pour l'instant : le plan se remplit tout seul dès qu'un QCM rate une question."
    : sature
      ? `${retardees.length} cartes sont dues pour ${Math.round(retardees.length * MINUTES_PAR_CARTE)} minutes — il en faut ${budget} de ton côté. Le plan prend les plus en retard et reporte le reste au lendemain, pas à la fin de la semaine.`
      : `${journees.length} journée(s) couvertes, ${totalMinutes} minutes au total. Rien n'est envoyé nulle part : c'est un calcul sur tes propres lignes.`;

  return { journees, total_cartes: nbToutes(journees), minutes_par_carte: MINUTES_PAR_CARTE, sature, retard_total_minutes: retardTotal, message };
}

function nbToutes(journees: Journee[]): number {
  return journees.reduce((a, j) => a + j.blocs.reduce((x, b) => x + b.cartes.length, 0), 0);
}
