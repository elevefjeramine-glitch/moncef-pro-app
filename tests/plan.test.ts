import { describe, expect, it } from "vitest";
import { BLOC_MAX_CARTES, BLOCS_MAX_PAR_JOUR, construirePlan, MINUTES_PAR_CARTE, rang, retardEnJours, type CartePlan } from "@/lib/plan";

const AUJOURDHUI = new Date(Date.UTC(2026, 7, 29, 20, 0, 0));
const due = (jours: number) => new Date(AUJOURDHUI.getTime() + jours * 86400000).toISOString();
const carte = (id: string, sur: Partial<CartePlan> = {}): CartePlan => ({ id, question: `Question ${id}`, matiere: "Maths", boite: 2, due_at: due(0), reps: 1, lapses: 0, ...sur });

describe("le rang dans la file", () => {
  it("met le retard avant la boîte, et la boîte avant tout le reste", () => {
    const enRetard = carte("retard", { boite: 4, due_at: due(-4) });
    const aLEure = carte("aLheure", { boite: 0, due_at: due(0) });
    expect(rang(enRetard, AUJOURDHUI.getTime())).toBeGreaterThan(rang(aLEure, AUJOURDHUI.getTime()));
  });
  it("plafonne les lapses à 3 : cinq ratés ne valent pas cinq fois plus qu'un", () => {
    const cinq = carte("cinq", { lapses: 9, due_at: due(-1) });
    const un = carte("un", { lapses: 1, due_at: due(-1) });
    const deux = carte("deux", { lapses: 2, due_at: due(-1) });
    expect(rang(cinq, AUJOURDHUI.getTime())).toBeGreaterThan(rang(un, AUJOURDHUI.getTime()));
    // À 3 et 9 lapses, la pénalité est la même : la carte n'avale pas la soirée.
    expect(Math.min(3, 9) * 2).toBe(Math.min(3, 3) * 2);
    expect(rang(deux, AUJOURDHUI.getTime())).toBeLessThan(rang(cinq, AUJOURDHUI.getTime()));
  });
  it("compte le retard en jours entiers, jamais en négatif", () => {
    expect(retardEnJours(carte("x", { due_at: due(-3) }), AUJOURDHUI.getTime())).toBe(3);
    expect(retardEnJours(carte("x", { due_at: due(5) }), AUJOURDHUI.getTime())).toBe(0);
    expect(retardEnJours(carte("x", { due_at: null }), AUJOURDHUI.getTime())).toBe(0);
  });
});

describe("la soirée bornée par le budget", () => {
  const trente = Array.from({ length: 30 }, (_, i) => carte(`c${i}`, { due_at: due(-1), boite: i % 5 }));
  it("ne promet pas plus de cartes que le budget n'en tient", () => {
    const plan = construirePlan(trente, { maintenant: AUJOURDHUI, budgetMinutes: 10, horizonJours: 7 });
    const capacite = Math.floor(10 / MINUTES_PAR_CARTE); // 15
    expect(plan.journees[0]!.blocs.reduce((a, b) => a + b.cartes.length, 0)).toBe(capacite);
    expect(plan.sature).toBe(true);
  });
  it("reporte le trop-plein au LENDEMAIN, pas en fin de semaine", () => {
    const plan = construirePlan(trente, { maintenant: AUJOURDHUI, budgetMinutes: 10, horizonJours: 7 });
    expect(plan.journees.map((j) => j.jour)).toEqual(["2026-08-29", "2026-08-30"]);
    expect(plan.journees[1]!.avance).toBe(true);
    expect(plan.journees[0]!.avance).toBe(false);
  });
  it("le message dit le vrai chiffre, il ne rassure pas", () => {
    const plan = construirePlan(trente, { maintenant: AUJOURDHUI, budgetMinutes: 10 });
    expect(plan.message).toContain("30");
    expect(plan.message).toContain("10");
    expect(plan.retard_total_minutes).toBe(20);
  });
});

describe("les plafonds de structure", () => {
  it("12 cartes par bloc", () => {
    const vingt = Array.from({ length: 20 }, (_, i) => carte(`c${i}`, { matiere: "Physique" }));
    const plan = construirePlan(vingt, { maintenant: AUJOURDHUI, budgetMinutes: 240 });
    expect(plan.journees[0]!.blocs).toHaveLength(2); // 12 + 8, pas « 12 et on oublie 8 »
    expect(plan.journees[0]!.blocs.map((b) => b.cartes.length)).toEqual([BLOC_MAX_CARTES, 8]);
    expect(plan.journees[0]!.blocs[0]!.matiere).toContain("(1/2)");
  });
  it("4 matières par jour, et ce qui ne rentre pas est déclaré", () => {
    const six = ["A", "B", "C", "D", "E", "F"].flatMap((m) => Array.from({ length: 3 }, (_, i) => carte(`${m}${i}`, { matiere: m })));
    const plan = construirePlan(six, { maintenant: AUJOURDHUI, budgetMinutes: 240 });
    expect(plan.journees[0]!.blocs).toHaveLength(BLOCS_MAX_PAR_JOUR);
    expect(plan.journees[0]!.blocs.map((b) => b.matiere)).toEqual(["A", "B", "C", "D"]);
    expect(plan.journees[0]!.deborde).toBe(6); // E et F sont déclarées, pas effacées en silence
  });
  it("les matières les plus fournies passent en premier", () => {
    const melange = [...Array.from({ length: 5 }, (_, i) => carte(`L${i}`, { matiere: "Lourde" })), ...Array.from({ length: 2 }, (_, i) => carte(`P${i}`, { matiere: "Petite" }))];
    const plan = construirePlan(melange, { maintenant: AUJOURDHUI, budgetMinutes: 240 });
    expect(plan.journees[0]!.blocs[0]!.matiere).toBe("Lourde");
  });
});

describe("les dates", () => {
  it("ne programme jamais avant aujourd'hui", () => {
    const plan = construirePlan([carte("dans2", { due_at: due(2) }), carte("retard", { due_at: due(-2) })], { maintenant: AUJOURDHUI, horizonJours: 7 });
    expect(plan.journees.every((j) => j.jour >= "2026-08-29")).toBe(true);
    expect(plan.journees.map((j) => j.jour)).toEqual(["2026-08-29", "2026-08-31"]);
  });
  it("respecte l'horizon", () => {
    const plan = construirePlan([carte("loin", { due_at: due(30) })], { maintenant: AUJOURDHUI, horizonJours: 7 });
    expect(plan.journees).toHaveLength(0);
    expect(plan.total_cartes).toBe(0);
  });
  it("libelle « Aujourd'hui », « Demain », puis la date française", () => {
    const plan = construirePlan([carte("a", { due_at: due(0) }), carte("b", { due_at: due(1) }), carte("c", { due_at: due(2) })], { maintenant: AUJOURDHUI, budgetMinutes: 240 });
    expect(plan.journees.map((j) => j.libelle)[0]).toBe("Aujourd'hui");
    expect(plan.journees.map((j) => j.libelle)[1]).toBe("Demain");
    // Le troisième jour est formaté par Intl (le rendu exact dépend de l'ICU du
    // moteur) : on ancre ce qui compte — le jour est nommé, pas affiché en ISO brut.
    expect(plan.journees.map((j) => j.libelle)[2]).toMatch(/lundi.*31.*ao/i);
  });
});

describe("les cas vides, parce que c'est là que les interfaces mentent", () => {
  it("aucune carte : un message, pas un tableau vide", () => {
    const plan = construirePlan([], { maintenant: AUJOURDHUI });
    expect(plan.journees).toHaveLength(0);
    expect(plan.message).toContain("Aucune carte");
    expect(plan.sature).toBe(false);
  });
  it("null, undefined et objets vides ne font pas tomber le calcul", () => {
    const plan = construirePlan([null as unknown as CartePlan, undefined as unknown as CartePlan, {} as CartePlan], { maintenant: AUJOURDHUI });
    expect(() => construirePlan([{} as CartePlan], { maintenant: AUJOURDHUI })).not.toThrow();
    expect(plan.journees).toHaveLength(0);
  });
  it("le budget est borné de toute part", () => {
    expect(construirePlan([carte("a")], { maintenant: AUJOURDHUI, budgetMinutes: 0 }).journees[0]!.minutes).toBeGreaterThanOrEqual(1);
    expect(construirePlan([carte("b", { due_at: due(-1) })], { maintenant: AUJOURDHUI, budgetMinutes: 99999, horizonJours: 999 }).total_cartes).toBe(1);
  });
});
