/**
 * L'import de document, du fichier jusqu'à la ligne en base.
 *
 * Ce fichier exécute le VRAI chemin : `extraire()` (le module du navigateur, ici sous
 * Node) puis les mêmes appels HTTP que la page Thunder, sur le déploiement passé en
 * `BASE`. Under Node, `fetch` est celui de l'environnement — le même que celui du
 * navigateur pour ce trajet-là (POST JSON, jeton porteur).
 *
 * Il ne reste ici qu'une chose non mesurable : l'onglet d'un élève. Tout le reste —
 * les pages conservées, la longueur annoncée = la longueur stockée, et le fait qu'un
 * import ne débite aucun crédit — est lu en base.
 *
 *   BASE=https://<id>--proappmoncef.netlify.app SK=<service_role> PAT=<supabase> npm run verif:import
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extraire, versSources } from "@/lib/extraire";

const BASE = (process.env.BASE ?? "").replace(/\/$/, "");
const SK = process.env.SK ?? "";
const PAT = process.env.PAT ?? "";
const SUPA = "https://ggnwtszeitrrfhedgipv.supabase.co";
const ANON = "sb_publishable_he8qnS-M5-uDmTVGkinzWw_39yD0BOO";
const jouer = Boolean(BASE && SK && PAT);

let uid = "";
let jeton = "";
let soldeAvant = -1;
const ids = new Set<string>();

async function sql(q: string) {
  const r = await fetch(`https://api.supabase.com/v1/projects/ggnwtszeitrrfhedgipv/database/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${PAT}`, "content-type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
  const t = await r.text();
  return JSON.parse(t.startsWith("[") || t.startsWith("{") ? t : "[]");
}

async function thunder(corps: Record<string, unknown>) {
  const r = await fetch(BASE + "/api/thunder", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${jeton}` },
    body: JSON.stringify(corps),
  });
  return { statut: r.status, corps: await r.json().catch(() => ({})) as any };
}

describe.skipIf(!jouer)("import d'un PDF de 120 pages, en conditions réelles", () => {
  beforeAll(async () => {
    const mdp = "Test-" + Math.random().toString(36).slice(2) + "!aA";
    const mail = `verif.import.${Date.now()}@exemple.test`;
    const creation = await fetch(SUPA + "/auth/v1/admin/users", {
      method: "POST",
      headers: { apikey: SK, authorization: `Bearer ${SK}`, "content-type": "application/json" },
      body: JSON.stringify({ email: mail, password: mdp, email_confirm: true, app_metadata: { role: "normal" } }),
    });
    const u = (await creation.json()) as { id?: string };
    uid = u.id ?? "";
    expect(uid).toMatch(/[0-9a-f-]{30,}/);
    const session = await fetch(SUPA + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: ANON, "content-type": "application/json" },
      body: JSON.stringify({ email: mail, password: mdp }),
    });
    jeton = ((await session.json()) as { access_token?: string }).access_token ?? "";
    expect(jeton.length).toBeGreaterThan(20);
    const solde = await sql(`select tokens from public.users where id='${uid}'`);
    soldeAvant = Number(Array.isArray(solde) ? (solde[0] as any)?.tokens ?? 0 : 0);
  }, 120_000);

  afterAll(async () => {
    for (const id of ids) {
      await thunder({ mode: "sources", action: "remove", id }).catch(() => {});
    }
    if (uid) {
      await fetch(SUPA + "/auth/v1/admin/users/" + uid, { method: "DELETE", headers: { apikey: SK, authorization: `Bearer ${SK}` } }).catch(() => {});
    }
  }, 120_000);

  it("importe les tranches, et la longueur annoncée est la longueur stockée", async () => {
    const buf = readFileSync(path.join(__dirname, "fixtures", "cours-120.pdf"));
    const r = await extraire(
      { name: "cours-120.pdf", type: "application/pdf", size: buf.length, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer },
      { cible: 8_000 } // on force la découpe : quatre sources au moins, pour voir le trajet plusieurs fois
    );
    const sources = versSources(r);
    expect(sources.length).toBeGreaterThanOrEqual(4);

    for (const s of sources) {
      const { statut, corps } = await thunder({ mode: "sources", action: "add", nouveau: { titre: s.titre, matiere: "physique", texte: s.texte } });
      expect(statut).toBe(200);
      expect(typeof corps.ajoute?.id).toBe("string");
      expect(Number(corps.ajoute?.longueur)).toBe(s.texte.length); // la colonne générée, pas un compteur maison
      ids.add(corps.ajoute.id as string);
    }

    const liste = await thunder({ mode: "sources", action: "list" });
    expect(liste.corps.sources.length).toBe(sources.length);

    // Relu EN BASE : le marqueur de page doit survivre au voyage, sinon la citation
    // « [p. 87] » promise n'existe nulle part.
    const lignes = (await sql(
      `select left(texte, 8) as debut, char_length(texte) as n, longueur from public.thunder_sources where user_id='${uid}' order by created_at`
    )) as { debut: string; n: number; longueur: number }[];
    expect(lignes.length).toBe(sources.length);
    expect(lignes.every((l) => /^\[p\. \d/.test(l.debut))).toBe(true);
    expect(lignes.every((l) => Number(l.n) === Number(l.longueur))).toBe(true);
    const tout = (await sql(`select string_agg(texte, ' ' order by created_at) as t from public.thunder_sources where user_id='${uid}'`)) as { t: string }[];
    expect(tout[0]?.t).toContain("[p. 87]");
    expect(tout[0]?.t).toMatch(/REPONSE CIBLE/);
  }, 180_000);

  it("ne débite aucun crédit : le solde du compte est celui du jour, intact", async () => {
    const apres = (await sql(`select tokens from public.users where id='${uid}'`)) as { tokens: number }[];
    expect(Number(apres[0]?.tokens)).toBe(soldeAvant);
  }, 90_000);

  it("et sans jeton, l'import n'existe pas", async () => {
    const r = await fetch(BASE + "/api/thunder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "sources", action: "add", nouveau: { titre: "x", texte: "y".repeat(500) } }),
    });
    expect(r.status).toBe(401);
  }, 60_000);
});

it("la séance est jouée seulement si BASE/SK/PAT sont fournis", () => {
  expect(jouer || !process.env.FORCE_VÉRITÉ).toBe(true);
  if (!jouer) console.warn("   import réel NON JOUÉ : BASE/SK/PAT absents de l'environnement");
});
