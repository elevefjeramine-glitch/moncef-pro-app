/**
 * Lire un document là où il se trouve : dans le navigateur de l'élève.
 *
 * Le pourquoi, d'abord. `/api/thunder` accepte jusqu'à 400 000 caractères par source,
 * mais une fonction Netlify synchrone tamponne au plus 6 Mo de charge utile (limite
 * d'AWS Lambda, pas réglable). Envoyer un PDF de 40 Mo au serveur pour qu'il en lise les
 * pages est donc structurellement impossible. Extraire le texte ICI — aucun octet ne
 * traverse le réseau avant que le document ne soit devenu du texte — l'est.
 *
 * Ce module est isomorphe : la même fonction sert au bouton « Glisse ton cours » et aux
 * tests Node (`tests/extraire.test.ts`), qui lui passent de vrais fichiers. Ce n'est pas
 * une maquette : c'est le chemin exécuté en production qui est mesuré.
 *
 * Deux choses qu'il faut savoir pour lire la suite :
 *  · un PDF scanné n'a pas de couche texte : on le dit, on n'invente rien ;
 *  · les numéros de page sont écrits dans le texte (`[p. 87]`), parce que la base ne
 *    stocke que du texte — c'est ce qui rend une citation vérifiable à l'œil.
 */

/** Un fichier plus gros que ça n'est pas refusé par la base, c'est refusé par la raison :
 *  la lecture complète bloque le fil principal plusieurs secondes sur un téléphone d'élève. */
export const TAILLE_MAX_FICHIER = 12 * 1024 * 1024;

/** Visée par source, en caractères. 90 000 ≈ 300 Ko JSON : on reste très sous la limite
 *  de 2 Mo du corps de requête, même en français avec ses accents (3 octets par lettre). */
export const CIBLE_TRANCHE = 90_000;

/** Plafond d'une tranche : sous le `CHECK (char_length(texte) <= 400000)` de la colonne. */
export const PLAFOND_TRANCHE = 380_000;

/** Planchier : sous les 40 caractères minimaux, une source ne peut rien citer. */
export const PLANCHER_TRANCHE = 40;

/** Nombre de sources maximum pour une séance d'import : au-delà, on tronque et on le dit. */
export const TRANCHES_MAX = 40;

/** Le worker est vendous dans `public/` : un URL figé, chargeable hors-ligne, et vérifiable
 *  par un simple `curl`. Son contenu doit correspondre à la version installée (contrôlé). */
export const CHEMIN_WORKER_PDF = "/pdf.worker.min.mjs";

export type Support = "pdf" | "docx" | "texte";

export type Tranche = {
  /** Titre de la source telle qu'elle apparaîtra dans le rail : « Cours · p. 1-3 ». */
  titre: string;
  texte: string;
  pageDebut: number;
  pageFin: number;
};

export type Resultat = {
  support: Support;
  nom: string;
  octets: number;
  pages: number;
  caracteres: number;
  tranche: Tranche[];
  avertissements: string[];
};

export class ErreurExtraction extends Error {
  constructor(message: string, readonly code: "taille" | "support" | "vide" | "lecture" | "dependance") {
    super(message);
    this.name = "ErreurExtraction";
  }
}

const EXT_TEXTES = ["txt", "md", "markdown", "csv", "tsv", "json"] as const;

/** Un fichier est un nom, un type MIME, et de quoi lire ses octets. Les trois suffisent,
 *  et ça permet de tester sans fabriquer un faux `File` du DOM. */
export type Fichier = {
  name: string;
  // `| undefined` explicite : le projet est en `exactOptionalPropertyTypes`, donc passer
  // `type: undefined` depuis l'appelant (un `File` sans MIME) doit rester légal.
  type?: string | undefined;
  size?: number | undefined;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export function detecterSupport(fichier: Pick<Fichier, "name" | "type">): Support {
  const ext = (fichier.name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf" || fichier.type === "application/pdf") return "pdf";
  if (ext === "docx" || fichier.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if ((EXT_TEXTES as readonly string[]).includes(ext) || /^text\//.test(fichier.type ?? "")) return "texte";
  throw new ErreurExtraction(
    `Format non pris en charge : ${ext ? "." + ext : fichier.type || "inconnu"}. Sont lus : PDF (avec du texte), DOCX, TXT, MD, CSV, JSON. Un scan ou une image passe par la pièce jointe du chat, pas par ici.`,
    "support"
  );
}

/** Le marqueur de page, et rien d'autre — une fonction séparée parce que c'est ce que le
 *  test vérifie dans la réponse du serveur en aval (citation `[p. 87]` retrouvée). */
export function marqueurPage(page: number): string {
  return `[p. ${page}]`;
}

/**
 * Regrouper les pages en sources. On ne coupe jamais au milieu d'une page : un extrait
 * cité qui commencerait à la ligne 4 d'une page perd son contexte, et le QCM le paie.
 */
export function decouperEnTranches(pages: { page: number; texte: string }[], cible = CIBLE_TRANCHE, plafond = PLAFOND_TRANCHE): Tranche[] {
  const sorties: Tranche[] = [];
  let courant: { page: number; texte: string }[] = [];
  let longueur = 0;

  const pousser = () => {
    if (!courant.length) return;
    const bloc = courant.map((p) => `${marqueurPage(p.page)}\n${p.texte.trim()}`).join("\n\n").trim();
    if (bloc.length >= PLANCHER_TRANCHE) {
      const debut = courant[0]?.page ?? 1;
      const fin = courant[courant.length - 1]?.page ?? debut;
      sorties.push({ titre: "", texte: bloc, pageDebut: debut, pageFin: fin });
    }
    courant = [];
    longueur = 0;
  };

  for (const p of pages) {
    const taille = p.texte.trim().length + 12;
    // Une page plus longue que le plafond est la seule chose qu'on se permet de couper :
    // sinon elle ne rentrerait jamais dans la colonne.
    if (taille > plafond) {
      pousser();
      for (let i = 0; i < p.texte.length; i += plafond) {
        const morceaux = p.texte.slice(i, i + plafond);
        sorties.push({ titre: "", texte: `${marqueurPage(p.page)}\n${morceaux.trim()}`, pageDebut: p.page, pageFin: p.page });
      }
      continue;
    }
    if (longueur + taille > cible) pousser();
    courant.push(p);
    longueur += taille;
  }
  pousser();

  const tronque = sorties.length > TRANCHES_MAX;
  const retenues = tronque ? sorties.slice(0, TRANCHES_MAX) : sorties;
  return retenues.map((t, i) => ({
    ...t,
    titre: `p. ${t.pageDebut}${t.pageFin > t.pageDebut ? "-" + t.pageFin : ""}${retenues.length > 1 ? " · " + (i + 1) + "/" + retenues.length : ""}`,
  }));
}

/** `pdf.worker.min.mjs` et `pdfjs-dist` doivent être du même millésime : un worker qui ne
 *  correspond pas à la bibliothèque se traduit par un échec de chargement silencieux. */
export function versionDuWorkerOk(texteWorker: string, versionBibliotheque: string): boolean {
  const annoncee = /PDF.js v([0-9.]+)/.exec(texteWorker);
  if (annoncee) return annoncee[1] === versionBibliotheque;
  // Le worker MINIFIÉ ne garde pas l'en-tête lisible : il porte malgré tout le numéro
  // de version dans sa chaîne interne. C'est ce qu'on contrôle ici — un worker d'un autre
  // millésime se traduit par un « Loading PDF worker failed » côté élève, silencieux au build.
  return texteWorker.includes(versionBibliotheque);
}

async function lirePdf(u8: Uint8Array): Promise<{ page: number; texte: string }[]> {
  let lib: any;
  try {
    lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (e: unknown) {
    throw new ErreurExtraction("La bibliothèque de lecture PDF n'a pas pu être chargée : " + (e instanceof Error ? e.message.slice(0, 90) : "échec"), "dependance");
  }
  const GlobalWorkerOptions = lib.GlobalWorkerOptions;
  if (GlobalWorkerOptions && !GlobalWorkerOptions.workerSrc) GlobalWorkerOptions.workerSrc = CHEMIN_WORKER_PDF;
  const doc = await lib.getDocument({ data: u8, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages: { page: number; texte: string }[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const contenu = await page.getTextContent();
    // Les items de pdfjs portent leur ordonnée : deux items au même `transform[5]` sont
    // sur la même ligne. Sans ça, on obtient un bloc de 3 000 caractères sans saut de
    // ligne, et la recherche lexicale devient mauvaise — c'est le défaut qu'on corrige ici.
    const lignes = new Map<number, string[]>();
    for (const item of contenu.items as any[]) {
      const s = typeof item.str === "string" ? item.str : "";
      if (!s) continue;
      const y = Math.round((item.transform?.[5] ?? 0) * 2) / 2;
      const cle = [...lignes.keys()].find((k) => Math.abs(k - y) < 3) ?? y;
      if (!lignes.has(cle)) lignes.set(cle, []);
      lignes.get(cle)!.push(s);
    }
    const texte = [...lignes.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, mots]) => mots.join(" ").replace(/[ \t]{2,}/g, " ").trim())
      .filter(Boolean)
      .join("\n");
    pages.push({ page: n, texte });
    page.cleanup?.();
  }
  await doc.destroy?.();
  return pages;
}

async function lireDocx(ab: ArrayBuffer): Promise<string> {
  let mammoth: any;
  try {
    mammoth = await import("mammoth");
  } catch (e: unknown) {
    throw new ErreurExtraction("La bibliothèque DOCX n'a pas pu être chargée : " + (e instanceof Error ? e.message.slice(0, 90) : "échec"), "dependance");
  }
  // Mammoth a deux portes d'entrée selon l'hôte : `arrayBuffer` dans le navigateur
  // (browser/unzip.js), `buffer` sous Node (lib/unzip.js). Les donner les deux garde un
  // seul code pour la prod et pour le test — et le test mesure bien le code livré.
  const entree = { arrayBuffer: ab, buffer: new Uint8Array(ab) };
  const r = await (mammoth.extractRawText ?? mammoth.default?.extractRawText)(entree);
  return String(r?.value ?? "");
}

/** Un DOCX n'a pas de pages au sens d'un PDF (la pagination dépend de la police et de
 *  l'imprimante). On numérote donc des sections — et le titre le dit, pour ne pas
 *  faire croire à une page 12 qui n'existe nulle part. */
export function paginerDocx(texte: string): { page: number; texte: string }[] {
  const blocs = texte
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  return blocs.map((b, i) => ({ page: i + 1, texte: b }));
}

/**
 * Le point d'entrée du bouton « Glisse ton cours ».
 * Ne lève que `ErreurExtraction` : l'interface n'a qu'à afficher `message`.
 */
export async function extraire(fichier: Fichier, opts?: { cible?: number }): Promise<Resultat> {
  const support = detecterSupport(fichier);
  const ab = await fichier.arrayBuffer().catch(() => {
    throw new ErreurExtraction("Le fichier n'a pas pu être lu (onglet fermé, fichier déplacé ?). Réessaie.", "lecture");
  });
  const octets = ab.byteLength;
  if (typeof fichier.size === "number" && fichier.size > TAILLE_MAX_FICHIER) {
    throw new ErreurExtraction(`Fichier de ${(fichier.size / 1048576).toFixed(1)} Mo : trop gros pour être lu dans l'onglet. Vise moins de ${TAILLE_MAX_FICHIER / 1048576} Mo, ou découpe le cours.`, "taille");
  }
  if (octets > TAILLE_MAX_FICHIER) {
    throw new ErreurExtraction(`Le fichier dépasse ${TAILLE_MAX_FICHIER / 1048576} Mo une fois lu : import refusé.`, "taille");
  }

  const avertissements: string[] = [];
  let pages: { page: number; texte: string }[] = [];

  if (support === "pdf") {
    pages = await lirePdf(new Uint8Array(ab));
    const utiles = pages.filter((p) => p.texte.trim().length >= PLANCHER_TRANCHE).length;
    if (utiles === 0) {
      throw new ErreurExtraction(
        `Aucun texte dans ce PDF de ${pages.length} page(s) : c'est un scan (pages images). La lecture d'un scan demande la reconnaissance optique — passe par la pièce jointe du chat, qui envoie l'image au modèle, ou colle le texte.`,
        "vide"
      );
    }
    if (utiles < pages.length) avertissements.push(`${pages.length - utiles} page(s) sans texte exploitable (images, en-têtes vides) ont été sautées.`);
  } else if (support === "docx") {
    const texte = await lireDocx(ab);
    if (texte.trim().length < PLANCHER_TRANCHE) throw new ErreurExtraction("Ce DOCX ne contient pas de texte lisible (40 caractères minimum).", "vide");
    avertissements.push("Un document Word n'a pas de pages fixes : les numéros ci-dessous sont des sections, pas des pages imprimées.");
    pages = paginerDocx(texte);
  } else {
    const texte = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(ab)).replace(/\r\n/g, "\n");
    if (texte.trim().length < PLANCHER_TRANCHE) throw new ErreurExtraction("Ce fichier est vide ou trop court pour être cité (40 caractères minimum).", "vide");
    // Une seule « page » pour un fichier texte : le marqueur reste, pour que la recherche
    // et les futures cartes parlent toutes le même langage.
    pages = texte.split(/\n{2,}/).map((bloc, i) => ({ page: i + 1, texte: bloc }));
    if (pages.length > 1) avertissements.push("Le fichier texte a été coupé sur ses paragraphes : les numéros sont des blocs, pas des pages.");
  }

  // `cible` ne sert qu'aux tests et à un réglage fin : la production laisse le défaut.
  const tranche = decouperEnTranches(pages, opts?.cible ?? CIBLE_TRANCHE);
  if (tranche.length === 0) throw new ErreurExtraction("Rien à retenir de ce document : le texte extrait est trop court après nettoyage.", "vide");
  if (tranche.length === TRANCHES_MAX && pages.length > TRANCHES_MAX) {
    avertissements.push(`Import limité à ${TRANCHES_MAX} sources : la suite du document n'a pas été indexée.`);
  }

  const nom = fichier.name.replace(/\.[A-Za-z0-9]{1,5}$/, "").slice(0, 120) || "document";
  const caracteres = tranche.reduce((n, t) => n + t.texte.length, 0);
  return {
    support,
    nom,
    octets,
    pages: support === "pdf" ? pages.length : tranche.length,
    caracteres,
    tranche: tranche.map((t) => ({ ...t, titre: `${nom} · ${t.titre}`.slice(0, 200) })),
    avertissements,
  };
}

/** Ce que la route `/api/thunder` attend, tel que l'appelera le navigateur : une source
 *  à la fois, pour ne jamais approcher les 2 Mo du corps de requête. */
export function versSources(r: Resultat): { titre: string; texte: string }[] {
  return r.tranche.map((t) => ({ titre: t.titre.slice(0, 200), texte: t.texte.slice(0, PLAFOND_TRANCHE) }));
}
