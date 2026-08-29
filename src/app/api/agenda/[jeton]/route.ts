import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { makeAdminClient } from "@/lib/compte";
import { construireIcs, jetonValide, type Cours, type Devoir, type Evenement } from "@/lib/agenda";

// GET /api/agenda/<jeton>.ics — le fichier lui-même, lu par un client calendrier.
//
// C'est la seule route PUBLIQUE de l'application qui expose des données personnelles,
// et elle l'est par un URL secret : un client calendrier ne sait pas tenir une session,
// il sait rappeler une URL. Tout le reste de ce fichier découle de ce seul fait.
//
//  · Le jeton se lit dans l'URL et se compare à la table `agenda_tokens` (index unique).
//    Un lien retiré et un lien jamais créé renvoient le MÊME 404 qu'un lien inconnu :
//    aucune façon de deviner si un compte existe.
//  · La réponse ne contient QUE ce que l'élève a saisi : cours, échéances, événements.
//    Pas de nom, pas d'e-mail, pas de solde de crédits, pas de notes.
//  · `Cache-Control: private` : le contenu ne dépend que du jeton, mais le mettre en
//    cache partagé reviendrait à le servir à un tiers qui lirait l'URL dans le cache.
//  · On note la lecture (date + compteur) : à « mon lien tourne-t-il encore ? »,
//    l'application répond par un nombre plutôt que par un doute.

// Pas de client d'administration au niveau du module : `next build` évalue ce
// fichier pour collecter les routes, à un moment où SUPABASE_SERVICE_ROLE_KEY
// n'est pas dans l'environnement — et la construction échouerait (`supabaseKey is
// required`). Le client se crée donc à la requête, comme sur /api/thunder.

function quaranteQuatre() {
  return new NextResponse("Lien d'agenda inconnu ou retiré. Régénère-le depuis l'emploi du temps.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ jeton: string }> }) {
  const brut = (await ctx.params).jeton ?? "";
  const jeton = brut.endsWith(".ics") ? brut.slice(0, -4) : brut;
  if (!jetonValide(jeton)) return quaranteQuatre();

  const ADMIN = makeAdminClient();
  const { data: ligne } = await ADMIN.from("agenda_tokens").select("user_id, lectures").eq("jeton", jeton).maybeSingle();
  if (!ligne) return quaranteQuatre();
  const uid = String(ligne.user_id);

  const maintenant = new Date();
  const debut = maintenant.toISOString().slice(0, 10);
  const [rCours, rDevoirs, rEvenements] = await Promise.all([
    ADMIN.from("schedule").select("id, day_index, week, subj, time_slot, created_at").eq("user_id", uid).order("day_index", { ascending: true }),
    // Seules les échéances À VENIR comptent : un calendrier n'est pas un historique, et
    // y empiler un an de devoirs rendus fait disparaître ce qui reste à faire.
    ADMIN.from("homework").select("id, subject, task, due_date, status, priority, created_at").eq("user_id", uid).or("is_done.is.null,is_done.eq.false").gte("due_date", debut).order("due_date", { ascending: true }).limit(400),
    ADMIN.from("events").select("id, title, description, event_date, event_time, category, created_at").eq("user_id", uid).gte("event_date", debut).order("event_date", { ascending: true }).limit(400),
  ]);

  // La date d'écriture la plus récente du compte : c'est elle qui devient DTSTAMP, pour
  // que deux relectures le même jour rendent le même fichier (voir src/lib/agenda.ts).
  const ecritures = [...(rCours.data ?? []), ...(rDevoirs.data ?? []), ...(rEvenements.data ?? [])]
    .map((l: { created_at?: string | null }) => String(l?.created_at ?? ""))
    .filter(Boolean)
    .sort();
  const ics = construireIcs(
    {
      cours: (rCours.data ?? []) as Cours[],
      devoirs: (rDevoirs.data ?? []) as Devoir[],
      evenements: (rEvenements.data ?? []) as Evenement[],
    },
    { maintenant, stamp: ecritures.length ? (ecritures[ecritures.length - 1] ?? maintenant.toISOString()) : maintenant.toISOString() }
  );

  // ETag + 304 : un abonnement qui rappelle tous les jours ne doit pas rapporter 40 Ko
  // quand rien n'a changé. Le comparateur accepte les formes faibles (`W/"…"`) et les
  // listes : certains clients renvoient l'empreinte telle quelle, d'autres sans `W/`,
  // d'autres encore une liste des deux — on compare donc l'empreinte nue.
  const empreinte = createHash("sha1").update(ics, "utf8").digest("base64url");
  const etag = `W/"${empreinte}"`;
  const inmA = req.headers.get("if-none-match");
  if (inmA && inmA.split(",").map((x) => x.trim().replace(/^W\//, "").replace(/^"|"$/g, "")).includes(empreinte)) {
    void ADMIN.from("agenda_tokens").update({ vu_le: maintenant.toISOString(), lectures: Number(ligne.lectures ?? 0) + 1 }).eq("jeton", jeton).then(() => {});
    return new NextResponse(null, {
      status: 304,
      headers: { etag, "cache-control": "private, max-age=1800", "content-type": "text/calendar; charset=utf-8" },
    });
  }


  // Best effort : si l'écriture du compteur échoue, le calendrier se charge quand même.
  void ADMIN.from("agenda_tokens").update({ vu_le: maintenant.toISOString(), lectures: Number(ligne.lectures ?? 0) + 1 }).eq("jeton", jeton).then(() => {});

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="agenda.ics"',
      etag,
      "cache-control": "private, max-age=1800",
      "x-content-type-options": "nosniff",
      "x-agenda-cours": String((rCours.data ?? []).length),
      "x-agenda-devoirs": String((rDevoirs.data ?? []).length),
      "x-agenda-evenements": String((rEvenements.data ?? []).length),
    },
  });
}
