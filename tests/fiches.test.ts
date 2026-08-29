import { describe, expect, it } from "vitest";
import { CIBLE_PAR_FICHE, consigneDecoupage, decouperTexte, extraireTableau, FICHES_MAX_PAR_APPEL, pagesDans, texteBlocs, texteFiche, validerFiches, POINTS_MAX } from "@/lib/fiches";

const titre = (n: number) => `# Chapitre ${n}`;
const paragraphe = (n: number, mot = "contenu") => Array.from({ length: n }, (_, i) => `${mot} ${i} ${"lorem ipsum dolor sit amet ".repeat(3)}`).join("\n\n");
const coursAvecTitres = (combien: number) => Array.from({ length: combien }, (_, i) => `${titre(i + 1)}\n${paragraphe(12)}\n${paragraphe(12)}`).join("\n\n");

describe("le découpage local, sans modèle", () => {
  it("suit les titres markdown", () => {
    const { blocs } = decouperTexte(coursAvecTitres(5));
    expect(blocs).toHaveLength(5);
    expect(blocs.map((b) => b.titre)).toEqual(["Chapitre 1", "Chapitre 2", "Chapitre 3", "Chapitre 4", "Chapitre 5"]);
    expect(blocs.map((b) => b.index)).toEqual([0, 1, 2, 3, 4]);
  });
  it("suit aussi « 2.3 Something », « I. » et « Leçon 3 »", () => {
    const brut = ["Leçon 3", paragraphe(10), "2.4 La photosynthèse", paragraphe(10), "III. Bilan", paragraphe(10)].join("\n\n");
    const { blocs } = decouperTexte(brut);
    expect(blocs.length).toBeGreaterThan(1);
    expect(blocs.some((b) => /photosynthèse/.test(b.titre ?? ""))).toBe(true);
  });
  it("ne perd aucun caractère, fenêtrage cumulé inclus", () => {
    const brut = paragraphe(1200);
    const premier = decouperTexte(brut, { cible: 4000 });
    expect(premier.blocs.length).toBeGreaterThan(5);
    expect(premier.blocs).toHaveLength(FICHES_MAX_PAR_APPEL); // la fenêtre, pas une perte
    for (const b of premier.blocs) expect(b.caractères).toBeLessThanOrEqual(Math.ceil(4000 * 1.75));
    // Parcourir TOUTES les fenêtres doit rendre le texte entier : c'est la propriété
    // qui compte pour l'élève (reprendre où on s'est arrêté ne doit rien faire perdre).
    const sansEspaces = (t: string) => t.replace(/\s+/g, "");
    const rendu: string[] = [];
    let sautes = 1;
    let depart = 0;
    while (sautes > 0 || depart === 0) {
      const p = decouperTexte(brut, { cible: 4000, aPartirDe: depart });
      rendu.push(...p.blocs.map((b) => b.texte));
      sautes = p.sautes;
      depart += p.blocs.length;
      if (depart > premier.total + FICHES_MAX_PAR_APPEL) break;
    }
    expect(sansEspaces(rendu.join(""))).toHaveLength(sansEspaces(brut).length);
  });
  it("recolle les miettes plutôt que de créer une fiche de deux lignes", () => {
    const brut = `${titre(1)}\n${paragraphe(10)}\n\n# Note\nTrès court.\n\n${titre(2)}\n${paragraphe(10)}`;
    const { blocs } = decouperTexte(brut);
    expect(blocs).toHaveLength(2);
    expect(blocs[0]!.texte).toContain("Très court.");
  });
  it("garde les marqueurs de page avec la fiche qui les contient", () => {
    const brut = `${titre(1)}\n[p. 12]\n${paragraphe(10)}\n\n${titre(2)}\n[p. 13-14]\n${paragraphe(10)}`;
    const { blocs } = decouperTexte(brut);
    expect(blocs[0]!.pages).toEqual([12]);
    expect(blocs[1]!.pages).toEqual([13, 14]);
    expect(pagesDans("[p. 7] et [p. 9-10]")).toEqual([7, 9, 10]);
  });
  it("fenêtre à 12 fiches par appel et dit ce qui reste", () => {
    const { blocs, sautes, total } = decouperTexte(coursAvecTitres(30));
    expect(total).toBe(30);
    expect(blocs).toHaveLength(FICHES_MAX_PAR_APPEL);
    expect(sautes).toBe(30 - FICHES_MAX_PAR_APPEL);
    const suite = decouperTexte(coursAvecTitres(30), { aPartirDe: FICHES_MAX_PAR_APPEL });
    expect(suite.blocs[0]!.index).toBe(FICHES_MAX_PAR_APPEL);
    expect(suite.blocs.map((b) => b.titre)).not.toEqual(blocs.map((b) => b.titre));
  });
  it("tient sur un texte vide ou d'un mot", () => {
    expect(decouperTexte("").blocs).toHaveLength(0);
    expect(decouperTexte("un mot").blocs).toHaveLength(1);
    expect(decouperTexte("un mot").blocs[0]!.texte).toBe("un mot");
  });
});

describe("la validation de ce que renvoie le modèle", () => {
  const { blocs } = decouperTexte(coursAvecTitres(3));
  it("accepte un tableau bien formé, même entouré de prose ou de backticks", () => {
    const brut = 'Voici le résultat :\n```json\n[{"fiche":0,"titre":"Ouverture","points":["Un point assez long pour passer.","Un deuxième point long aussi."]}]\n```';
    const r = validerFiches(brut, blocs);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fiches[0]).toMatchObject({ fiche: 0, titre: "Ouverture" });
  });
  it("jette une fiche qui référence un bloc inexistant", () => {
    const r = validerFiches('[{"fiche":99,"titre":"Inventée","points":["Un point suffisamment long.","Et un deuxième encore plus long."]}]', blocs);
    expect(r.ok).toBe(false);
  });
  it("jette une fiche à un seul point, reprend le titre du bloc quand il manque", () => {
    const unSeul = validerFiches('[{"fiche":1,"titre":"X","points":["Un seul point, mais long."]}]', blocs);
    expect(unSeul.ok).toBe(false);
    const sansTitre = validerFiches('[{"fiche":1,"points":["Un point long suffisant.","Un autre point long suffisant."]}]', blocs);
    expect(sansTitre.ok).toBe(true);
    if (sansTitre.ok) expect(sansTitre.fiches[0]!.titre).toBe("Chapitre 2");
  });
  it("coupe à 4 points et dédoublonne", () => {
    const six = [1, 2, 3, 4, 5, 6].map((i) => `"point numéro ${i} assez long pour être garde"`).join(",");
    const r = validerFiches(`[{"fiche":0,"titre":"T","points":[${six}]},{"fiche":0,"titre":"T2","points":[${six}]}]`, blocs);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fiches[0]!.points).toHaveLength(POINTS_MAX);
      expect(r.fiches).toHaveLength(1);
      expect(r.jetees[0]!.motif).toContain("double");
    }
  });
  it("refuse le vide, le texte seul et le JSON tronqué", () => {
    for (const mauvais of ["", "rien à lire ici", "[", "[{\"fiche\":0", "[]"]) {
      expect(validerFiches(mauvais, blocs).ok).toBe(false);
    }
    expect(extraireTableau("[{\"a\":1}] et du texte après")).toEqual([{ a: 1 }]);
    expect(extraireTableau("aucun tableau")).toBeNull();
  });
});

describe("ce qui est stocké et ce qui est demandé au modèle", () => {
  const { blocs } = decouperTexte(coursAvecTitres(2));
  it("la fiche enregistrée contient le résumé ET le corps d'origine", () => {
    const texte = texteFiche(blocs[0]!, { fiche: 0, titre: "T", points: ["Un point.", "Deux point."], pages: [] });
    expect(texte).toContain("# T");
    expect(texte).toContain("• Un point.");
    expect(texte).toContain(blocs[0]!.texte.slice(0, 60));
    expect(texte.length).toBeLessThanOrEqual(60000);
  });
  it("sans fiche validée, on stocke le bloc seul", () => {
    expect(texteFiche(blocs[1]!)).toBe(blocs[1]!.texte);
  });
  it("la consigne rappelle l'interdiction d'ajouter du hors-texte et cite les numéros", () => {
    const c = consigneDecoupage(blocs) + texteBlocs(blocs);
    expect(c).toContain("AUCUNE information extérieure");
    expect(c).toContain("[0]");
    expect(c).toContain("[1]");
    expect(c).toContain("Chapitre 1");
    expect(c).toContain("caractères ---");
  });
  it("la cible par défaut est celle annoncée", () => {
    expect(CIBLE_PAR_FICHE).toBe(3200);
  });
});
