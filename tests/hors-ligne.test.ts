/**
 * Les décisions du hors-ligne, jugées sans navigateur.
 *
 * Le service worker lui-même n'est pas exécutable ici : il n'est donc JAMAIS la source
 * d'une décision. `src/lib/hors-ligne.ts` décide, `public/sw-offline.js` applique — et le
 * dernier test de ce fichier vérifie que les deux parlent bien le même vocabulaire
 * (noms de caches). Une dérive entre les deux rend ce test rouge, ce qui est le but.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DUREE_MAX_JOURS,
  LIMITE_FICHES,
  NOMS_CACHES,
  cachesAEffacer,
  cleSnapshot,
  decider,
  estPerime,
  messageHorsLigne,
  snapshotFiches,
  trancher,
  type TextesBandeau,
} from "@/lib/hors-ligne";

const JOUR = 86_400_000;
const TEXTE: TextesBandeau = {
  hors_ligne: "Hors-ligne",
  fiches: "fiche(s)",
  cartes: "carte(s)",
  devoirs: "devoir(s)",
  gardes: "gardés",
  rien_garde: "rien n'a encore été gardé",
  rien_ne_part: "rien ne partira",
};

describe("la table de décision", () => {
  const ici = "https://proappmoncef.netlify.app";
  it("ne met jamais en cache ce qui écrit", () => {
    expect(decider("POST", new URL(ici + "/api/thunder"), true)).toBe("reseau-seul");
    expect(decider("DELETE", new URL(ici + "/api/revisions"), true)).toBe("reseau-seul");
  });
  it("ne touche pas à une origine étrangère", () => {
    expect(decider("GET", new URL("https://cdn.exemple.fr/x.css"), false)).toBe("reseau-seul");
  });
  it("sert les assets hashés depuis le cache — ils sont immuables par construction", () => {
    expect(decider("GET", new URL(ici + "/_next/static/chunks/abc123.js"), true)).toBe("cache-puis-reseau");
    expect(decider("GET", new URL(ici + "/icon-192.png"), true)).toBe("cache-puis-reseau");
    expect(decider("GET", new URL(ici + "/pdf.worker.min.mjs"), true)).toBe("cache-puis-reseau");
  });
  it("passe une page et une API au réseau d'abord, avec le cache en secours", () => {
    expect(decider("GET", new URL(ici + "/app/thunder"), true)).toBe("reseau-puis-cache");
    expect(decider("GET", new URL(ici + "/api/revisions"), true)).toBe("reseau-puis-cache");
  });
});

describe("les snapshots, par compte et par âge", () => {
  it("range une fiche sous la clé du compte : un poste partagé ne doit pas se resservir", () => {
    const cle = cleSnapshot("11111111-1111-1111-1111-111111111111", "fiches");
    expect(cle).toContain("11111111");
    expect(cle).toContain("fiches");
    expect(cle.startsWith(NOMS_CACHES.fiches)).toBe(true);
  });
  it("à la déconnexion, on nomme aussi les caches par compte, pas seulement les trois socles", () => {
    const uid = "aaaa";
    const liste = cachesAEffacer(uid);
    expect(liste).toContain(NOMS_CACHES.statique);
    expect(liste).toContain(NOMS_CACHES.pages);
    expect(liste).toContain(cleSnapshot(uid, "cartes"));
    expect(cachesAEffacer(null).length).toBe(3);
  });
  it("une fiche de plus de sept jours est périmée, pas conservée par habitude", () => {
    const maintenant = 1_800_000_000_000;
    expect(estPerime(maintenant - 6 * JOUR, maintenant)).toBe(false);
    expect(estPerime(maintenant - (DUREE_MAX_JOURS + 0.1) * JOUR, maintenant)).toBe(true);
    expect(estPerime(Number.NaN, maintenant)).toBe(true);
  });
  it("on garde les plus récentes, jusqu'à vingt, et jamais de périmées", () => {
    const maintenant = 2_000_000_000_000;
    const entrees = Array.from({ length: 34 }, (_, i) => ({ id: String(i), garde: maintenant - i * 1000 - (i > 25 ? 9 * JOUR : 0) }));
    const retenues = trancher(entrees, maintenant);
    expect(retenues.length).toBe(LIMITE_FICHES);
    expect(retenues[0]?.id).toBe("0");
    expect(retenues.every((e) => !estPerime(e.garde, maintenant))).toBe(true);
  });
  it("le snapshot d'une liste de sources ne dépasse jamais la limite, et borne ses champs", () => {
    const sources = Array.from({ length: 40 }, (_, i) => ({ id: String(i), titre: "t".repeat(300), matiere: "m".repeat(200), longueur: 1234 }));
    const items = snapshotFiches(sources);
    expect(items.length).toBe(LIMITE_FICHES);
    expect(items[0]!.titre.length).toBeLessThanOrEqual(200);
    expect(items[0]!.matiere.length).toBeLessThanOrEqual(80);
    expect(items[0]!.garde).toBeGreaterThan(0);
  });
});

describe("le bandeau, et ce qu'il promet", () => {
  it("ne dit rien quand le réseau est là", () => {
    expect(messageHorsLigne({ fiches: 3, cartes: 1, devoirs: 0 }, true, TEXTE)).toBe("");
  });
  it("dit qu'il n'y a rien à lire, au lieu de faire croire que tout est là", () => {
    const m = messageHorsLigne({ fiches: 0, cartes: 0, devoirs: 0 }, false, TEXTE);
    expect(m).toContain("Hors-ligne");
    expect(m).toContain("rien n'a encore été gardé");
  });
  it("compte, et prévient explicitement que rien ne part", () => {
    const m = messageHorsLigne({ fiches: 12, cartes: 9, devoirs: 2 }, false, TEXTE);
    expect(m).toMatch(/12 fiche\(s\)/);
    expect(m).toMatch(/9 carte\(s\)/);
    expect(m).toMatch(/2 devoir\(s\)/);
    expect(m).toContain("rien ne partira");
  });
});

describe("le worker publié dit la même chose que ce module", () => {
  it("les trois noms de caches sont les mêmes des deux côtés", () => {
    const sw = readFileSync(path.join(__dirname, "..", "public", "sw-offline.js"), "utf8");
    for (const nom of Object.values(NOMS_CACHES)) expect(sw).toContain(nom);
  });
  it("et le worker ne met rien en cache sur une écriture — la garde est bien dans le fichier servi", () => {
    const sw = readFileSync(path.join(__dirname, "..", "public", "sw-offline.js"), "utf8");
    expect(sw).toMatch(/requete\.method !== "GET"/);
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/);
  });
});
