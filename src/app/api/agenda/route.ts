import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { makeAdminClient } from "@/lib/compte";
import { LIMITE_CORPS, lireJson, reponse413, rejeterSiAnnonceTropGrosse } from "@/lib/corps";
import { resuméAgenda } from "@/lib/agenda";

// Le lien d'agenda (lot A4) — côté authentifié.
//
//   GET  /api/agenda   -> état du lien (existe ? dernière lecture ? ce qu'il contient)
//   POST /api/agenda   -> { action: "creer" | "regenerer" | "retirer" }
//
// GET parce qu'il ouvre une page : le coller dans Google/Apple se fait depuis l'appli,
// sans jeton d'API. POST exige une session, comme tout le reste.
// ZÉRO CRÉDIT : lire et écrire sa propre table d'agenda ne facture rien, jamais.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ggnwtszeitrrfhedgipv.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function tokenFrom(req: Request, body?: { authToken?: string } | null): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (h?.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  if (body?.authToken) return body.authToken;
  return null;
}

type uid = { uid: string; admin: ReturnType<typeof makeAdminClient> };

async function client(req: Request, body?: { authToken?: string } | null): Promise<uid | NextResponse> {
  const token = tokenFrom(req, body);
  if (!token) return reponse401();
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reponse401();
  return { uid: user.id, admin: makeAdminClient() };
}

function reponse401() {
  return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
}

async function compter(admin: ReturnType<typeof makeAdminClient>, uid: string) {
  const [cours, devoirs, evenements] = await Promise.all([
    admin.from("schedule").select("id", { count: "exact", head: true }).eq("user_id", uid),
    admin.from("homework").select("id", { count: "exact", head: true }).eq("user_id", uid).or("is_done.is.null,is_done.eq.false").not("due_date", "is", null),
    admin.from("events").select("id", { count: "exact", head: true }).eq("user_id", uid).not("event_date", "is", null),
  ]);
  return { cours: cours.count ?? 0, devoirs: devoirs.count ?? 0, evenements: evenements.count ?? 0 };
}

export async function GET(req: Request) {
  const c = await client(req);
  if (c instanceof NextResponse) return c;
  const { data } = await c.admin.from("agenda_tokens").select("cree_le, vu_le, lectures").eq("user_id", c.uid).maybeSingle();
  const comptes = await compter(c.admin, c.uid);
  return NextResponse.json({
    actif: Boolean(data),
    cree_le: data?.cree_le ?? null,
    vu_le: data?.vu_le ?? null,
    lectures: data?.lectures ?? 0,
    comptes,
    resume: resuméAgenda(comptes),
    // Le jeton n'est renvoyé qu'aux moments où l'élève le voit (ci-dessous) : un GET qui
    // tourne en boucle ne doit pas le recopier dans le journal d'une extension.
    lien: null as string | null,
  });
}

export async function POST(req: Request) {
  // `lireJson` LÈVE un `CorpsTropVolumineux` (et n'envoie pas un objet `{ ok }`) : la
  // lecture est donc encadrée exactement comme sur /api/thunder, sinon le premier
  // appel un peu gros se transforme en 500 illisible au lieu d'un 413 expliqué.
  const tropGrosse = rejeterSiAnnonceTropGrosse(req, LIMITE_CORPS.agenda);
  if (tropGrosse) return tropGrosse;
  let body: { action?: string; authToken?: string } | null = null;
  try {
    body = (await lireJson(req, LIMITE_CORPS.agenda)) as { action?: string; authToken?: string };
  } catch (e: unknown) {
    const refus = reponse413(e);
    if (refus) return refus;
    return NextResponse.json({ error: "Corps de requête illisible : du JSON est attendu." }, { status: 400 });
  }
  const c = await client(req, body);
  if (c instanceof NextResponse) return c;
  const action = String(body?.action ?? "creer");

  if (action === "retirer") {
    await c.admin.from("agenda_tokens").delete().eq("user_id", c.uid);
    return NextResponse.json({ actif: false, message: "Lien retiré : il renvoie un 404 depuis maintenant." });
  }

  const jeton = crypto.randomBytes(16).toString("hex");
  const ligne = { user_id: c.uid, jeton };
  if (action === "regenerer") {
    // Une seule ligne par compte : `user_id` est la clé primaire, donc un upsert remplace
    // le jeton et l'ancien meurt — c'est exactement ce qu'on attend de « régénérer ».
    const { error } = await c.admin.from("agenda_tokens").upsert({ ...ligne, vu_le: null, lectures: 0 }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "Régénération impossible : " + error.message }, { status: 500 });
  } else {
    const { data: existant } = await c.admin.from("agenda_tokens").select("jeton").eq("user_id", c.uid).maybeSingle();
    if (existant) return NextResponse.json({ actif: true, lien: `/api/agenda/${existant.jeton}.ics`, message: "Le lien existe déjà — utilise « Régénérer » pour le changer." });
    const { error } = await c.admin.from("agenda_tokens").insert(ligne);
    if (error) return NextResponse.json({ error: "Création impossible : " + error.message }, { status: 500 });
  }

  const comptes = await compter(c.admin, c.uid);
  return NextResponse.json({
    actif: true,
    lien: `/api/agenda/${jeton}.ics`,
    comptes,
    resume: resuméAgenda(comptes),
    avert: "Le lien donne en lecture le cours, les échéances et les événements: c'est tout, et c'est déjà suffisant pour ne pas le publier.",
  });
}
