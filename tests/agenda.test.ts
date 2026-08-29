import { describe, expect, it } from "vitest";
import { analyserCreneau, ancrerJour, construireIcs, echapper, jetonValide, numeroSemaineIso, plier } from "@/lib/agenda";
import { pagesDans } from "@/lib/fiches";

const OCTETS_MAX = 75;
const lignesIcs = (ics: string) => ics.split("\r\n");

describe("créneau : ce que le site stocke réellement", () => {
  it("accepte la plage '08:00-09:00'", () => {
    expect(analyserCreneau("08:00-09:00")).toEqual({ debut: "08:00", fin: "09:00", presume: false });
  });
  it("accepte le tiret demi-cadratin recopié d'un traitement de texte", () => {
    expect(analyserCreneau("08:00\u201309:30")).toEqual({ debut: "08:00", fin: "09:30", presume: false });
  });
  it("une seule heure = une heure de cours, et le drapeau `presume` est là pour qu'on le DISE", () => {
    expect(analyserCreneau("08:00")).toEqual({ debut: "08:00", fin: "09:00", presume: true });
    expect(analyserCreneau("8h")).toEqual({ debut: "08:00", fin: "09:00", presume: true });
  });
  it("ne décale pas minuit : 23:40 + 60 min repasse au lendemain, pas 24:40", () => {
    expect(analyserCreneau("23:40")!.fin).toBe("00:40");
  });
  it("refuse ce qui n'est pas une heure, sans inventer", () => {
    for (const vide of ["", "   ", "sur les coups de 8h", "08h30 du matin", "—" as string, null, undefined]) {
      expect(analyserCreneau(vide as string)).toBeNull();
    }
  });
});

describe("RFC 5545 : les trois pièges", () => {
  it("échappe point-virgule, virgule, antislash et saut de ligne", () => {
    expect(echapper("Maths; Physique, chimie\nsuite")).toBe("Maths\\; Physique\\, chimie\\nsuite");
    expect(echapper("C:\\cours")).toBe("C:\\\\cours");
    expect(echapper(null)).toBe("");
  });
  it("plie à 75 OCTETS et pas 75 caractères", () => {
    const longue = "SUMMARY:" + "é".repeat(200);
    const sortie = plier(longue);
    for (const l of sortie.split("\r\n")) expect(Buffer.byteLength(l, "utf8")).toBeLessThanOrEqual(OCTETS_MAX);
    // Replié, on retrouve l'original au caractère près : aucune perte, aucun collage.
    expect(sortie.replace(/\r\n /g, "")).toBe(longue);
    for (const l of sortie.split("\r\n").slice(1)) expect(l.startsWith(" ")).toBe(true);
  });
  it("ne coupe jamais au milieu d'un caractère multi-octets", () => {
    const sortie = plier("DESCRIPTION:" + "ع".repeat(120) + "a");
    for (const l of sortie.split("\r\n")) {
      expect(Buffer.byteLength(l, "utf8")).toBeLessThanOrEqual(OCTETS_MAX);
      // Un octet de continuation au bord = caractère tronqué ; UTF-8 valide = re-décodable.
      expect(() => Buffer.from(l, "utf8").toString("utf8")).not.toThrow();
      expect(Buffer.from(l, "utf8").toString("utf8")).toBe(l);
    }
  });
});

describe("semaines ISO et alternance A/B", () => {
  it("le numéro de semaine est l'ISO, pas le jour/7", () => {
    expect(numeroSemaineIso(new Date(Date.UTC(2026, 0, 1)))).toEqual({ numero: 1, pair: false });
    expect(numeroSemaineIso(new Date(Date.UTC(2026, 0, 5)))).toEqual({ numero: 2, pair: true });
    expect(numeroSemaineIso(new Date(Date.UTC(2025, 11, 29)))).toEqual({ numero: 1, pair: false });
    expect(numeroSemaineIso(new Date(Date.UTC(2026, 7, 29)))).toEqual({ numero: 35, pair: false });
  });
  it("saute en avant, jamais en arrière (le 29/08/2026 tombe un samedi)", () => {
    const samedi = new Date(Date.UTC(2026, 7, 29));
    expect(ancrerJour(0, null, samedi).toISOString().slice(0, 10)).toBe("2026-08-31"); // lundi prochain
    expect(ancrerJour(5, null, samedi).toISOString().slice(0, 10)).toBe("2026-08-29"); // aujourd'hui = samedi, et « aujourd'hui » compte
    expect(ancrerJour(4, null, samedi).toISOString().slice(0, 10)).toBe("2026-09-04"); // vendredi
  });
  it("A = semaines ISO paires, B = impaires, et les deux ne se chevauchent jamais", () => {
    const samedi = new Date(Date.UTC(2026, 7, 29)); // semaine 35, impaire
    const a = ancrerJour(0, "A", samedi);
    const b = ancrerJour(0, "B", samedi);
    expect(a.toISOString().slice(0, 10)).toBe("2026-08-31"); // lundi 31 = W36, pair
    expect(b.toISOString().slice(0, 10)).toBe("2026-09-07"); // lundi suivant = W37, impair
    expect(numeroSemaineIso(a).pair).toBe(true);
    expect(numeroSemaineIso(b).pair).toBe(false);
    expect(Math.round((b.getTime() - a.getTime()) / 86400000)).toBe(7);
    // Et A ne remonte jamais : lu un lundi de semaine impaire, il attend la semaine
    // paire suivante — c'est le prix d'une règle fixe, et il est payé une fois.
    expect(ancrerJour(0, "A", new Date(Date.UTC(2026, 8, 7))).toISOString().slice(0, 10)).toBe("2026-09-14");
  });
});

const JEUX = {
  cours: [
    { id: "11111111-1111-4111-8111-111111111111", day_index: 0, week: "A", subj: "Maths; analysé", time_slot: "08:00-09:00" },
    { id: "22222222-2222-4222-8222-222222222222", day_index: 2, week: "B", subj: "Physique", time_slot: "10:00" },
    { id: "33333333-3333-4333-8333-333333333333", day_index: 4, week: null, subj: "EPS", time_slot: "plus tard" },
  ],
  devoirs: [{ id: "44444444-4444-4444-8444-444444444444", subject: "Commentaire", task: "p. 12-14 ; à rendre", due_date: "2026-09-02", status: "todo", priority: "haute" }],
  evenements: [
    { id: "55555555-5555-4555-8555-555555555555", title: "Oral", description: "salle 4", event_date: "2026-09-04", event_time: "14:30", category: "oral" },
    { id: "66666666-6666-4666-8666-666666666666", title: "Conseil", description: null, event_date: "2026-09-05", event_time: null, category: null },
  ],
};

describe("le fichier .ics produit", () => {
  const ics = construireIcs(JEUX, { maintenant: new Date(Date.UTC(2026, 7, 29, 12, 0, 0)), nom: "Moncef", horizon: 120 });
  const lignes = lignesIcs(ics);
  const deplie = ics.replace(/\r\n /g, "");// aiguilles : le fichier est plié, on le déplie avant de chercher

  it("est un VCALENDAR complet, en CRLF, terminée par un retour ligne", () => {
    expect(lignes[0]).toBe("BEGIN:VCALENDAR");
    expect(lignes[lignes.length - 2]).toBe("END:VCALENDAR");
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.includes("\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
  });
  it("tient toutes ses lignes sous 75 octets", () => {
    for (const l of lignes) expect(Buffer.byteLength(l, "utf8")).toBeLessThanOrEqual(OCTETS_MAX);
  });
  it("contient un seul VTIMEZONE, sans DAYLIGHT (le Maroc n'y passe plus)", () => {
    expect(lignes.filter((l) => l === "BEGIN:VTIMEZONE")).toHaveLength(1);
    expect(deplie).not.toContain("BEGIN:DAYLIGHT");
    expect(deplie).toContain("TZOFFSETTO:+0100");
  });
  it("pose 5 VEVENT (3 cours, 1 devoir, 2 événements = 6 ? non : les comptes exacts)", () => {
    expect(lignes.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(JEUX.cours.length + JEUX.devoirs.length + JEUX.evenements.length);
  });
  it("écrit les semaines A/B en INTERVAL=2, le reste en INTERVAL=1, et ONLY the courses portent un RRULE", () => {
    const rrules = lignes.filter((l) => l.startsWith("RRULE:"));
    expect(rrules.filter((l) => l.includes("INTERVAL=2"))).toHaveLength(2);
    expect(rrules.filter((l) => l.includes("INTERVAL=1;"))).toHaveLength(1);
    expect(rrules).toHaveLength(3); // les trois cours, pas le devoir ni les événements
    expect(rrules.every((l) => /UNTIL=\d{8}T\d{6}Z$/.test(l))).toBe(true);
  });
  it("utilise le fuseau nommé pour les heures, et VALUE=DATE pour le reste", () => {
    expect(lignes.filter((l) => l.startsWith("DTSTART;TZID=Africa/Casablanca:"))).toHaveLength(3); // cours 1, cours 2, oral
    expect(lignes.filter((l) => l.startsWith("DTSTART;VALUE=DATE:"))).toHaveLength(3); // EPS, devoir, conseil
  });
  it("dit dans le texte quand il a dû présumer ou renoncer", () => {
    expect(deplie).toContain("duree d'une heure par defaut");
    expect(deplie).toContain("horaire a verifier");
  });
  it("échappe le point-virgule d'une matière", () => {
    expect(deplie).toContain("SUMMARY:Maths\\; analys");
  });
  it("propose une alarme la veille du devoir", () => {
    expect(deplie).toContain("TRIGGER:-P1D");
  });
  it("est stable à la seconde près, et l'horizon glisse avec l'heure de lecture", () => {
    const bis = construireIcs(JEUX, { maintenant: new Date(Date.UTC(2026, 7, 29, 12, 0, 0)), nom: "Moncef", horizon: 120 });
    expect(bis).toBe(ics);
    const sansTampon = (t: string) => t.split("\r\n").filter((l) => !l.startsWith("DTSTAMP") && !l.startsWith("RRULE"));
    const plusTard = construireIcs(JEUX, { maintenant: new Date(Date.UTC(2026, 7, 29, 18, 0, 0)), nom: "Moncef", horizon: 120 });
    expect(sansTampon(plusTard)).toEqual(sansTampon(ics)); // mêmes UIDs, mêmes heures de cours
    const until = (t: string) => /UNTIL=(\d{8}T\d{6}Z)/.exec(t)![1]!;
    expect(until(plusTard)).toBe("20261227T180000Z"); // +6 h de lecture = +6 h de fichier
    expect(until(ics)).toBe("20261227T120000Z");
  });
  it("tolère l'absence totale de données", () => {
    const vide = construireIcs({ cours: [], devoirs: [], evenements: [] }, { maintenant: new Date(Date.UTC(2026, 7, 29)) });
    expect(vide).toContain("BEGIN:VCALENDAR");
    expect(vide).not.toContain("BEGIN:VEVENT");
  });
});

describe("jeton d'URL et marqueurs de page", () => {
  it("n'accepte que 32 hexadécimaux minuscules", () => {
    expect(jetonValide("a".repeat(32))).toBe(true);
    for (const mauvais of ["A".repeat(32), "a".repeat(31), "a".repeat(33), "", "z".repeat(32), "../x", null, undefined, 12 as unknown]) {
      expect(jetonValide(mauvais as string)).toBe(false);
    }
  });
  it("lit [p. 12] et [p. 12-14]", () => {
    expect(pagesDans("cours [p. 12] puis [p. 14-16] et [p. 3]")).toEqual([3, 12, 14, 15, 16]);
    expect(pagesDans("rien")).toEqual([]);
  });
});
