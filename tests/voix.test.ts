/**
 * La voix, testée sur un faux `speechSynthesis`.
 *
 * Ce que ça prouve : la sélection de voix, le découpage, le décompte des morceaux,
 * l'arrêt, et le comportement quand la machine n'a rien. Ce que ça NE prouve pas, et
 * c'est écrit pour qu'on ne le vende pas : le son qui sort des haut-parleurs, et la
 * présence réelle des voix sur le téléphone d'un élève — `tests/pwa-verif.py` le demande
 * au navigateur, pas à ce fichier.
 */
import { describe, expect, it } from "vitest";
import { choisirVoix, decouperEnPhrases, dicteeDisponible, etatDe, lire, nettoyerPourVoix, syntheseDisponible, type Morceau, type VoixNavigateur } from "@/lib/voix";

const VOIX: VoixNavigateur[] = [
  { name: "Google français", lang: "fr-FR", localService: false, default: true },
  { name: "Amélie", lang: "fr_FR", localService: true },
  { name: "Daniel (GB)", lang: "en-GB", localService: true },
  { name: "Houda", lang: "ar-MA", localService: true },
];

describe("choisir la voix qui parlera", () => {
  it("préfère la région attendue, et accepte le tiret comme le souligné", () => {
    expect(choisirVoix(VOIX, "fr")?.name).toBe("Google français");
    expect(choisirVoix([{ name: "Samira", lang: "fr_MA", localService: true }, { name: "Autre", lang: "fr-CA" }], "fr")?.name).toBe("Samira");
  });
  it("sans région exacte, prend une voix LOCALE plutôt qu'un service réseau", () => {
    const sansRegion = [{ name: "Réseau", lang: "fr-CA", localService: false }, { name: "Locale", lang: "fr-CA", localService: true }];
    expect(choisirVoix(sansRegion, "fr")?.name).toBe("Locale");
  });
  it("en arabe, cherche ar-MA (l'accent du cours), pas une voix générique", () => {
    expect(choisirVoix(VOIX, "ar")?.name).toBe("Houda");
  });
  it("ne promet rien quand la machine n'a aucune voix", () => {
    expect(choisirVoix([], "fr")).toBeNull();
    expect(choisirVoix([{ name: "Uniquement anglais", lang: "en-US" }], "fr")).toBeNull();
  });
});

describe("le texte, rendu parlable", () => {
  it("enlève le markdown, les citations de source et les numéros de page", () => {
    const md = "## Cinématique\n\n- **vitesse** scalaire [S3] constante [p. 87]\n\n| a | b |\n| - | - |\n| 1 | 2 |";
    const propre = nettoyerPourVoix(md);
    expect(propre).not.toMatch(/#/);
    expect(propre).not.toContain("[S3]");
    expect(propre).not.toContain("[p. 87]");
    expect(propre).not.toContain("**");
    expect(propre).toMatch(/vitesse scalaire constante/);
  });
  it("ne rend jamais un morceau plus long que la limite, ni vide", () => {
    const longue = "mot ".repeat(400) + ". Deuxième phrase courte.";
    const morceaux = decouperEnPhrases(longue);
    expect(morceaux.length).toBeGreaterThan(1);
    expect(morceaux.every((m) => m.length <= 220)).toBe(true);
    expect(morceaux.every((m) => m.trim().length > 0)).toBe(true);
  });
  it("une réponse vide ne produit aucun morceau", () => {
    expect(decouperEnPhrases("")).toEqual([]);
    expect(decouperEnPhrases("   \n\n  ")).toEqual([]);
    expect(decouperEnPhrases("![image](x.png)")).toEqual([]);
  });
  it("les blocs de code sont annoncés, pas lus lettre à lettre", () => {
    expect(nettoyerPourVoix("```py\nfor i in range(3)\n```")).toMatch(/bloc de code/);
  });
});

describe("lire, avec un faux moteur", () => {
  const moteur = () => {
    const parle: Morceau[] = [];
    return {
      parle,
      getVoices: () => VOIX,
      speak: (u: Morceau) => void parle.push(u),
      cancel: () => void parle.splice(0, parle.length),
      speaking: false,
      paused: false,
      pending: false,
      onvoiceschanged: null,
    };
  };
  it("met chaque phrase dans la file, avec la bonne voix et le débit réglé", () => {
    const m = moteur();
    const r = lire("Première phrase. Seconde phrase. Troisième phrase.", "fr", m);
    expect(r.morceaux).toBe(3);
    expect(m.parle.map((u) => u.text)).toEqual(["Première phrase.", "Seconde phrase.", "Troisième phrase."]);
    expect(m.parle[0]?.voice?.name).toBe("Google français");
    expect(m.parle[0]?.lang).toBe("fr-FR");
    expect(m.parle[0]?.rate).toBeCloseTo(1.02, 2);
  });
  it("en arabe, le débit descend", () => {
    const m = moteur();
    lire("جملة أولى. جملة ثانية.", "ar", m);
    expect(m.parle[0]?.rate).toBeLessThan(1);
    expect(m.parle[0]?.voice?.name).toBe("Houda");
  });
  it("annuler vide la file, et ne casse jamais si le moteur refuse", () => {
    const m = moteur();
    m.cancel = () => {
      throw new Error("moteur bouché");
    };
    const r = lire("Une phrase.", "fr", m);
    expect(() => r.annuler()).not.toThrow();
  });
  it("sans moteur, ou sans voix sur la machine : zéro morceau, et un annuler inoffensif", () => {
    expect(lire("Phrase.", "fr", undefined).morceaux).toBe(0);
    const sansVoix = moteur();
    sansVoix.getVoices = () => [];
    const r = lire("Phrase.", "fr", sansVoix);
    expect(r.morceaux).toBe(1); // on parle quand même : c'est le moteur qui choisira sa voix
    expect(r.voix).toBeNull();
    expect(syntheseDisponible({ getVoices: () => [] })).toBe(false);
    expect(syntheseDisponible(moteur())).toBe(true);
  });
  it("un speak qui lève vaut refus, pas un bouton qui rit tout seul", () => {
    const m = moteur();
    m.speak = () => {
      throw new Error("synthèse indisponible");
    };
    expect(lire("Une. Deux.", "fr", m).morceaux).toBe(0);
  });
  it("l'état affiché vient de l'objet, pas d'un compteur maison", () => {
    const m = moteur();
    expect(etatDe(m)).toBe("libre");
    m.speaking = true;
    expect(etatDe(m)).toBe("en_cours");
    m.paused = true;
    expect(etatDe(m)).toBe("en_pause");
    expect(etatDe(undefined)).toBe("indecis");
  });
});

describe("la dictée, montrée seulement là où elle marche", () => {
  const UA = {
    chrome: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    edge: "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
    ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  };
  it("Chrome et Edge : oui. Firefox, Safari, iOS : non.", () => {
    expect(dicteeDisponible(UA.chrome, true)).toBe(true);
    expect(dicteeDisponible(UA.edge, true)).toBe(true);
    expect(dicteeDisponible(UA.firefox, true)).toBe(false);
    expect(dicteeDisponible(UA.ios, true)).toBe(false);
  });
  it("sans l'objet du navigateur, le bouton n'existe pas — même sur Chrome", () => {
    expect(dicteeDisponible(UA.chrome, false)).toBe(false);
  });
});
