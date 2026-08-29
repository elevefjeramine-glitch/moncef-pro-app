import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { JOURS_SEMAINE } from "@/lib/agenda";

/**
 * Le dictionnaire est le seul endroit du site où quatre langues cohabitent, et il
 * n'avait AUCUN garde-fou : une clé ajoutée en français seulement se traduisait, chez
 * les autres, par… la clé elle-même, affichée telle quelle à l'élève. Mesuré le
 * 29/08/2026 : `en` était déjà en retard de 17 clés, `es` et `ar` de 31.
 *
 * Ce fichier ne répare pas ce passif (ce serait une livraison de 93 chaînes non
 * relues) : il VERROUILLE l'avenir. Règle retenue — toute clé présente en `fr` et
 * listée ci-dessous (les clés neuves de chaque lot) doit exister dans les quatre
 * langues. Le passif est enregistré dans `PROPOSITIONS.md` avec ses chiffres, pas nié.
 */
const fichier = readFileSync(new URL("../src/utils/i18n.tsx", import.meta.url), "utf8");
const LANGUES = ["fr", "en", "es", "ar"] as const;

/** Une clé = `propriete: "chaine"`, où la valeur peut contenir des virgules et des
 *  `\"`. Ce scanneur remplace un inventaire ligne-par-ligne : le dictionnaire range
 *  parfois plusieurs clés sur la même ligne (`home: "Inicio", calendar: "Calendario",`)
 *  et l'inventaire naïf avait annoncé 31 clés « manquantes » en espagnol et en arabe
 *  qui étaient toutes là. Une toise fausse fabrique de faux défauts — et, pire, des
 *  « corrections » qui ajoutent des doublons. Mesuré le 29/08/2026. */
const CLE = /([A-Za-z0-9_]+):\s*"((?:[^"\\]|\\.)*)"/g;

function bloc(langue: string): string[] {
  const lignes = fichier.split("\n");
  const debut = lignes.findIndex((l) => l === `  ${langue}: {`);
  if (debut === -1) throw new Error(`bloc ${langue} introuvable dans src/utils/i18n.tsx`);
  const fin = lignes.findIndex((l, i) => i > debut && /^  \},?$/.test(l));
  const corps = lignes.slice(debut + 1, fin).join("\n");
  const cles: string[] = [];
  CLE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CLE.exec(corps))) cles.push(m[1]!);
  return cles;
}

const CLES_DES_LOTS_RECENTS = [
  // Lot A4 · le lien d'agenda
  "sch_agenda", "sch_agenda_sub", "sch_agenda_lien", "sch_agenda_creer", "sch_agenda_afficher", "sch_agenda_copier", "sch_agenda_copie",
  "sch_agenda_copie_manuelle", "sch_agenda_regenerer", "sch_agenda_retirer", "sch_agenda_lu", "sch_agenda_jamais", "sch_agenda_aucun", "sch_agenda_note",
  // Lot C4 · le plan de révision
  "thunder_plan", "thunder_plan_sub", "thunder_plan_budget", "thunder_plan_horizon", "thunder_plan_calculer", "thunder_plan_min", "thunder_plan_retard",
  "thunder_plan_vide", "thunder_plan_note",
  // Lot B3 · le découpage en fiches
  "thunder_fiches", "thunder_fiches_aide", "thunder_fiches_lancer", "thunder_fiches_suite", "thunder_fiches_creees", "thunder_fiches_restants",
  "thunder_fiches_attente", "thunder_fiches_jetees",
];

describe("i18n : les langues ne se quittent pas", () => {
  it("les quatre blocs existent et sont fournis", () => {
    for (const l of LANGUES) expect(bloc(l).length, `bloc ${l}`).toBeGreaterThan(300);
  });
  it("chaque clé du dictionnaire existe dans les quatre langues", () => {
    const ref = new Set(bloc("fr"));
    const manques: string[] = [];
    for (const l of LANGUES) {
      const c = new Set(bloc(l));
      for (const cle of ref) if (!c.has(cle)) manques.push(`${l}.${cle}`);
    }
    expect(manques, manques.join(", ")).toEqual([]);
  });
  it("aucune langue ne déclare deux fois la même clé", () => {
    // Un doublon n'est pas joli : en JS le dernier gagne, donc la première traduction
    // devient invisible — c'est exactement comment naît une régression silencieuse.
    const redons: string[] = [];
    for (const l of LANGUES) {
      const vus = new Set<string>();
      for (const cle of bloc(l)) {
        if (vus.has(cle)) redons.push(`${l}.${cle}`);
        vus.add(cle);
      }
    }
    expect(redons, redons.join(", ")).toEqual([]);
  });
  it("les clés des lots récents sont traduites partout", () => {
    const manques: string[] = [];
    for (const cle of CLES_DES_LOTS_RECENTS) for (const l of LANGUES) if (!new Set(bloc(l)).has(cle)) manques.push(`${l}.${cle}`);
    expect(manques, manques.join(", ")).toEqual([]);
  });
  it("aucune clé neuve n'est une chaîne vide", () => {
    const vides: string[] = [];
    for (const cle of CLES_DES_LOTS_RECENTS) {
      const re = new RegExp(`\\n\\s{4}${cle}: "\\s*",`);
      if (re.test(fichier)) vides.push(cle);
    }
    expect(vides).toEqual([]);
  });
  it("les langues ont exactement le même nombre de clés", () => {
    const tailles = LANGUES.map((l) => [l, new Set(bloc(l)).size] as const);
    expect(new Set(tailles.map(([, n]) => n)).size, tailles.map(([l, n]) => `${l}=${n}`).join(" ")).toBe(1);
  });
});

describe("l'agenda et le site sont d'accord sur les jours", () => {
  it("JOURS_SEMAINE[0] est bien le jour que le site appelle `d0`", () => {
    // src/app/app/schedule/page.tsx construit sa liste avec t(lang,'d0'…'d6') : si un
    // jour le dictionnaire disait « Dimanche » en premier, l'export .ics se décalerait
    // d'un jour entier — silencieusement. Ce test est la seule garde-fou sur ce risque.
    const fr = fichier.slice(fichier.indexOf("  fr: {"));
    const d0 = /[{,\s]d0: "([^"]*)"/.exec(fr.slice(0, fr.indexOf("  en: {")));
    expect(d0?.[1]).toBe("Lundi");
    expect(JOURS_SEMAINE[0]).toBe("Lundi");
    expect(JOURS_SEMAINE).toHaveLength(7);
  });
});
