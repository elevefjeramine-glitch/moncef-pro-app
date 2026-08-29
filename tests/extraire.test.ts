/**
 * L'extraction de documents, jouée sur de vrais fichiers.
 *
 * Les fixtures sont générées par `tests/fabrique-fixtures.py` : un PDF de 120 pages dont
 * la page 87 porte une phrase unique, et un DOCX de quatre blocs. Si une de ces deux
 * preuves tombe, « glisse ton cours » ne vaut plus rien — c'est exactement ce qu'on veut
 * savoir.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CIBLE_TRANCHE,
  PLAFOND_TRANCHE,
  TRANCHES_MAX,
  decouperEnTranches,
  detecterSupport,
  extraire,
  marqueurPage,
  versionDuWorkerOk,
  versSources,
} from "@/lib/extraire";

const FIX = path.join(__dirname, "fixtures");
const fichier = (nom: string, type?: string) => {
  const buf = readFileSync(path.join(FIX, nom));
  return {
    name: nom,
    type,
    size: buf.length,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
  };
};

describe("le format, deviné sans se tromper de porte", () => {
  it("reconnaît pdf, docx et le texte par l'extension comme par le type MIME", () => {
    expect(detecterSupport({ name: "cours.pdf" })).toBe("pdf");
    expect(detecterSupport({ name: "cours.PDF", type: "application/pdf" })).toBe("pdf");
    expect(detecterSupport({ name: "cours.docx" })).toBe("docx");
    expect(detecterSupport({ name: "notes.md" })).toBe("texte");
    expect(detecterSupport({ name: "sans-extension", type: "text/plain" })).toBe("texte");
  });
  it("refuse un scan et le dit, au lieu de produire une source vide", async () => {
    expect(() => detecterSupport({ name: "scan.jpg", type: "image/jpeg" })).toThrowError(/non pris en charge/i);
    await expect(extraire(fichier("cours.docx", "image/jpeg"))).resolves.toBeTruthy(); // le nom gagne sur le MIME : assumé, testé
  });
});

describe("un vrai PDF de 120 pages", () => {
  it("extrait tout le document, page 87 incluse et repérable", async () => {
    const r = await extraire(fichier("cours-120.pdf", "application/pdf"));
    expect(r.support).toBe("pdf");
    expect(r.pages).toBe(120);
    // Une seule source ici, et c'est juste : le fixture fait 120 pages mais ~24 000
    // caractères, sous la visée de 90 000 par tranche. La découpe elle-même est jugée
    // plus bas, sur des entrées calibrées pour ça.
    expect(r.tranche.length).toBeGreaterThanOrEqual(1);
    expect(r.tranche.length).toBeLessThanOrEqual(TRANCHES_MAX);
    expect(r.tranche[0]?.pageDebut).toBe(1);
    expect(r.tranche[0]?.pageFin).toBe(120);
    const tout = r.tranche.map((t) => t.texte).join("\n");
    expect(tout).toContain(marqueurPage(87));
    expect(tout).toMatch(/REPONSE CIBLE/);
    // la phrase cible doit se trouver DANS la tranche qui annonce la page 87
    const porteuse = r.tranche.find((t) => t.texte.includes("REPONSE CIBLE"));
    expect(porteuse?.pageDebut).toBeLessThanOrEqual(87);
    expect(porteuse?.pageFin).toBeGreaterThanOrEqual(87);
  });
  it("reste sous le plafond de la colonne texte, tranche par tranche", async () => {
    const r = await extraire(fichier("cours-120.pdf", "application/pdf"));
    for (const t of r.tranche) {
      expect(t.texte.length).toBeLessThanOrEqual(PLAFOND_TRANCHE);
      expect(t.texte.length).toBeGreaterThanOrEqual(40);
      expect(t.titre).toMatch(/^cours-120 · p\. \d+(-\d+)?/);
    }
  });
  it("produit exactement ce que la route attend, sans rien inventer de plus", async () => {
    const r = await extraire(fichier("cours-120.pdf", "application/pdf"));
    const sources = versSources(r);
    expect(sources.length).toBe(r.tranche.length);
    expect(sources.every((s) => s.titre.length <= 200)).toBe(true);
    expect(JSON.stringify(sources[0]).length).toBeLessThan(1_200_000); // loin des 2 Mo du corps
  });
});

describe("un vrai DOCX", () => {
  it("lit les paragraphes, et avertit que ce ne sont pas des pages", async () => {
    const r = await extraire(fichier("cours.docx"));
    expect(r.support).toBe("docx");
    expect(r.tranche.length).toBe(1); // quatre blocs courts : une seule source
    expect(r.tranche[0]?.texte).toContain("Serment du Jeu de paume");
    expect(r.tranche[0]?.texte).toContain("20 juin 1789");
    expect(r.avertissements.join(" ")).toMatch(/sections, pas des pages/);
  });
});

describe("la découpe, seule, sans fichier", () => {
  it("ne coupe jamais entre deux pages si ça tient, et numérote les tranches", () => {
    const pages = Array.from({ length: 6 }, (_, i) => ({ page: i + 1, texte: "x".repeat(10) }));
    const t = decouperEnTranches(pages, CIBLE_TRANCHE);
    expect(t.length).toBe(1);
    expect(t[0]?.pageDebut).toBe(1);
    expect(t[0]?.pageFin).toBe(6);
    expect(t[0]?.texte).toContain(marqueurPage(4));
  });
  it("scinde quand ça dépasse la visée, en gardant les pages entières", () => {
    const pages = Array.from({ length: 12 }, (_, i) => ({ page: i + 1, texte: "y".repeat(30_000) }));
    const t = decouperEnTranches(pages, 90_000);
    expect(t.length).toBeGreaterThanOrEqual(4);
    expect(t.every((x) => x.texte.length <= PLAFOND_TRANCHE)).toBe(true);
    const couvertes = new Set(t.flatMap((x) => Array.from({ length: x.pageFin - x.pageDebut + 1 }, (_, k) => x.pageDebut + k)));
    expect(couvertes.size).toBe(12); // aucune page perdue, aucune dupliquée
  });
  it("découpe une page monstre — c'est la seule entorse assumée à la page entière", () => {
    const t = decouperEnTranches([{ page: 3, texte: "z".repeat(PLAFOND_TRANCHE * 2 + 100) }]);
    expect(t.length).toBeGreaterThanOrEqual(2);
    expect(t.every((x) => x.pageDebut === 3 && x.pageFin === 3)).toBe(true);
  });
  it("jette les pages vides au lieu d'en faire des sources", () => {
    const t = decouperEnTranches([{ page: 1, texte: "court" }, { page: 2, texte: "   " }]);
    expect(t.length).toBe(0);
  });
});

describe("le worker PDF vendous", () => {
  it("porte le millésime de la bibliothèque installée", () => {
    const entete = readFileSync(path.join(__dirname, "..", "public", "pdf.worker.min.mjs"), "utf8").slice(0, 4000);
    const version = JSON.parse(readFileSync(path.join(__dirname, "..", "node_modules", "pdfjs-dist", "package.json"), "utf8")).version as string;
    expect(versionDuWorkerOk(entete, version)).toBe(true);
  });
});
