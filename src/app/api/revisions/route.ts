import { NextResponse } from "next/server";
import { adminConfigure, makeAdminClient, todayUTC } from "@/lib/compte";
import { LIMITE_CORPS, lireJson, reponse413, rejeterSiAnnonceTropGrosse } from "@/lib/corps";
import { boiteSuivante, compteSemaine, echeance, empreinte, estNote, serieActuelle } from "@/lib/revisions";
import { messageRappel, notifier, pushConfigure, vapidPublic, type Abonnement } from "@/lib/push";

/**
 * Les révisions espacées : ce que le QCM de Thunder a fait rater revient à une date
 * calculée, au lieu de rester une phrase qu'on a lue une fois.
 *
 * Six modes, et un seul principe comptable : AUCUN ne facture de crédit, parce qu'aucun
 * n'appelle un modèle. Chaque carte est une ligne de la base, relue après écriture —
 * c'est le contrat du reste du projet (le modèle ne décide pas de ce qui est stocké).
 *
 *   etat       la file du jour + les compteurs (série, notes, doublons ignorés)
 *   creer      les questions ratées du QCM deviennent des cartes
 *   noter      encore / bien / facile → boîte suivante, échéance, jour compté
 *   ignorer    suppression franche (une carte qu'on ne veut plus voir n'est pas masquée)
 *   abonner    l'abonnement Web Push de ce navigateur
 *   desabonner idem, dans l'autre sens
 *   notifier   envoie tout de suite à CE compte (bouton de l'élève, jamais un tiers)
 *
 * Écriture en base = client de service : la RLS borne déjà chaque compte à ses lignes,
 * mais le rôle `authenticated` n'a pas le droit d'écrire ici (comme pour thunder_sources).
 */
export const maxDuration = 30;

const MODES = ["etat", "creer", "noter", "ignorer", "abonner", "desabonner", "notifier"] as const;
type Mode = (typeof MODES)[number];

function refus(message: string, statut = 400) {
  return NextResponse.json({ error: message, cout: 0, horodatage: new Date().toISOString() }, { status: statut });
}

export async function POST(req: Request) {
  const tropGrosse = rejeterSiAnnonceTropGrosse(req, LIMITE_CORPS.compte);
  if (tropGrosse) return tropGrosse;

  const entete = req.headers.get("authorization");
  if (!entete) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  let body: any;
  try {
    body = await lireJson(req, LIMITE_CORPS.compte);
  } catch (e: unknown) {
    const r = reponse413(e);
    if (r) return r;
    return NextResponse.json({ error: "Corps illisible : du JSON est attendu." }, { status: 400 });
  }

  const mode = String(body?.mode ?? "etat") as Mode;
  if (!MODES.includes(mode)) {
    return NextResponse.json({ error: `Mode inconnu : attend ${MODES.join(", ")}.` }, { status: 400 });
  }
  if (!adminConfigure()) {
    return NextResponse.json(
      { error: "Service non configuré : SUPABASE_SERVICE_ROLE_KEY est absente de l'environnement. Les révisions ne peuvent ni lire ni écrire." },
      { status: 503 }
    );
  }

  const db = makeAdminClient();
  const {
    data: { user },
    error: erreurAuth,
  } = await db.auth.getUser(entete.replace("Bearer ", ""));
  if (erreurAuth || !user) return NextResponse.json({ error: "Session invalide ou expirée." }, { status: 401 });
  const moi = String(user.id);

  try {
    // ── L'état de la file : tout est compté sur les lignes, rien n'est estimé ──────
    if (mode === "etat") {
      const maintenant = Date.now();
      const { data: cartes, error: e1 } = await db
        .from("review_cards")
        .select("id, question, reponse, ce_que_tu_avais, matiere, boite, reps, lapses, due_at, created_at, source_id, origine")
        .eq("user_id", moi)
        .order("due_at", { ascending: true })
        .limit(400);
      if (e1) return refus("Lecture impossible : " + e1.message, 500);
      const liste = cartes ?? [];
      const dues = liste.filter((c: any) => new Date(c.due_at).getTime() <= maintenant);
      const plusTard = liste.length - dues.length;
      const prochaine = liste.find((c: any) => new Date(c.due_at).getTime() > maintenant)?.due_at ?? null;
      const depuis = maintenant - 7 * 86400000;

      const { data: log } = await db.from("review_log").select("day, notees, justes").eq("user_id", moi).order("day", { ascending: false }).limit(120);
      const lignes = log ?? [];
      const notees7 = lignes.slice(0, 7).reduce((a: number, l: any) => a + (l.notees ?? 0), 0);
      const justes7 = lignes.slice(0, 7).reduce((a: number, l: any) => a + (l.justes ?? 0), 0);
      const { count: abo } = await db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", moi);
      const compteurs = compteSemaine(liste, depuis);

      return NextResponse.json({
        du_jour: dues.slice(0, 20),
        compteurs: {
          total: liste.length,
          du_aujourdhui: dues.length,
          plus_tard: plusTard,
          creees_7_jours: compteurs.creees,
          fragiles: compteurs.fragiles,
          notees_7_jours: notees7,
          justes_7_jours: justes7,
          serie_jours: serieActuelle(lignes.map((l: any) => l.day), todayUTC()),
          abonnements: abo ?? 0,
        },
        prochaine,
        horloge: todayUTC(),
        cle_publique_vapid: vapidPublic() || null,
        push_possible: pushConfigure(),
        cout: 0,
      });
    }

    // ── Nées d'une erreur du QCM : les doublons du même soir sont ignorés ─────────
    if (mode === "creer") {
      const recues = Array.isArray(body?.cartes) ? (body.cartes as any[]).slice(0, 20) : [];
      if (!recues.length) return refus("Rien à créer : envoie `cartes` (jusqu'à 20 par appel).");
      const questions = recues.map((c) => String(c?.question ?? "").trim()).filter((q) => q.length >= 3 && q.length <= 1200);
      if (!questions.length) return refus("Aucune question exploitable (3 à 1200 caractères attendus).");

      // Une carte ne peut être rattachée qu'à UNE source du compte : sinon un appel
      // fabriquerait un lien vers le cours d'un autre élève.
      const idsDemandes = [...new Set(recues.map((c) => String(c?.source_id ?? "")).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
      let idsValides = new Set<string>();
      if (idsDemandes.length) {
        const { data: miennes } = await db.from("thunder_sources").select("id").eq("user_id", moi).in("id", idsDemandes);
        idsValides = new Set((miennes ?? []).map((s: any) => s.id));
      }
      let sourcesIgnorees = 0;

      const lignes = recues.flatMap((c) => {
        const question = String(c?.question ?? "").trim();
        const reponse = String(c?.reponse ?? "").trim();
        if (question.length < 3 || question.length > 1200 || reponse.length < 1 || reponse.length > 1200) return [];
        const sourceId = String(c?.source_id ?? "");
        const rattache = idsValides.has(sourceId) ? sourceId : null;
        if (sourceId && !rattache) sourcesIgnorees += 1;
        return [{
          user_id: moi,
          source_id: rattache,
          question,
          reponse,
          ce_que_tu_avais: String(c?.ce_que_tu_avais ?? "").trim().slice(0, 1200) || null,
          matiere: String(c?.matiere ?? "").trim().slice(0, 60) || null,
          empreinte: empreinte(question),
          boite: 1,
          // Une carte née d'une erreur revient demain, pas dans trois jours.
          due_at: echeance(1),
          origine: c?.origine === "manuel" ? "manuel" : "quiz",
        }];
      });
      if (!lignes.length) return refus("Rien à créer après contrôle des longueurs.");

      const { data: ecrites, error } = await db
        .from("review_cards")
        .upsert(lignes, { onConflict: "user_id,empreinte", ignoreDuplicates: true })
        .select("id");
      if (error) return refus("Écriture refusée : " + error.message, 500);
      const creees = (ecrites ?? []).length;
      return NextResponse.json({
        demandees: recues.length,
        creees,
        doublons: lignes.length - creees,
        sources_ignorees: sourcesIgnorees,
        relu_en_base: { premier_jour: echeance(1).slice(0, 10) },
        cout: 0,
      });
    }

    // ── Noter une carte : la boîte bouge, le jour est compté, la valeur est relue ──
    if (mode === "noter") {
      const id = String(body?.carte_id ?? "");
      const note = String(body?.note ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return refus("Identifiant de carte attendu (uuid).");
      if (!estNote(note)) return refus("Note inconnue : attend encore, bien ou facile.");

      const { data: carte } = await db.from("review_cards").select("id, boite, reps, lapses, user_id").eq("id", id).single();
      if (!carte || carte.user_id !== moi) return NextResponse.json({ error: "Carte inconnue, ou elle n'est pas à toi." }, { status: 404 });

      const apres = boiteSuivante(Number(carte.boite), note);
      const { error: eMaj } = await db
        .from("review_cards")
        .update({
          boite: apres,
          due_at: echeance(apres),
          reps: Number(carte.reps ?? 0) + 1,
          lapses: Number(carte.lapses ?? 0) + (note === "encore" ? 1 : 0),
          last_grade_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (eMaj) return refus("Mise à jour refusée : " + eMaj.message, 500);

      const jour = todayUTC();
      const { data: log } = await db.from("review_log").select("notees, justes").eq("user_id", moi).eq("day", jour).maybeSingle();
      const notees = Number(log?.notees ?? 0) + 1;
      const justes = Number(log?.justes ?? 0) + (note === "encore" ? 0 : 1);
      const { error: eLog } = await db.from("review_log").upsert({ user_id: moi, day: jour, notees, justes, updated_at: new Date().toISOString() }, { onConflict: "user_id,day" });
      if (eLog) return refus("Journée non comptée : " + eLog.message, 500);

      const { data: relu } = await db.from("review_cards").select("boite, due_at, reps, lapses").eq("id", id).single();
      const { data: logRelu } = await db.from("review_log").select("notees, justes").eq("user_id", moi).eq("day", jour).maybeSingle();
      const { data: jours } = await db.from("review_log").select("day").eq("user_id", moi).order("day", { ascending: false }).limit(120);
      return NextResponse.json({
        boite_avant: Number(carte.boite),
        boite_apres: apres,
        relu_en_base: relu ?? null,
        jour: { notees: Number(logRelu?.notees ?? 0), justes: Number(logRelu?.justes ?? 0) },
        serie_jours: serieActuelle((jours ?? []).map((l: any) => l.day), jour),
        cout: 0,
      });
    }

    if (mode === "ignorer") {
      const id = String(body?.carte_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return refus("Identifiant de carte attendu (uuid).");
      // `.select()` après une suppression n'accepte pas d'options (contrat du client) :
      // on compte donc les lignes réellement rendues, ce qui est plus honnête qu'un
      // compteur annoncé — une carte qui n'était pas à toi n'apparaît pas ici.
      const { data: parties } = await db.from("review_cards").delete().eq("id", id).eq("user_id", moi).select("id");
      return NextResponse.json({ supprimees: (parties ?? []).length, cout: 0 });
    }

    // ── L'abonnement de ce navigateur ──────────────────────────────────────────────
    if (mode === "abonner") {
      const s = body?.subscription;
      const endpoint = String(s?.endpoint ?? "").trim();
      const p256dh = String(s?.keys?.p256dh ?? "").trim();
      const auth = String(s?.keys?.auth ?? "").trim();
      if (!/^https:\/\//.test(endpoint)) return refus("Abonnement refusé : l'`endpoint` doit être une URL https du service de notification.");
      if (p256dh.length < 30 || auth.length < 8) return refus("Abonnement incomplet : `p256dh` et `auth` sont exigés par le chiffrement Web Push.");
      const { error } = await db
        .from("push_subscriptions")
        .upsert({ user_id: moi, endpoint, p256dh, auth, user_agent: String(req.headers.get("user-agent") ?? "").slice(0, 160), last_error: null }, { onConflict: "endpoint" });
      if (error) return refus("Abonnement non enregistré : " + error.message, 500);
      const { count } = await db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", moi);
      return NextResponse.json({ abonne: true, abonnements_de_ce_compte: count ?? 0, cout: 0 });
    }

    if (mode === "desabonner") {
      const endpoint = String(body?.endpoint ?? "").trim();
      const { data: retirees } = await db.from("push_subscriptions").delete().eq("user_id", moi).eq("endpoint", endpoint).select("id");
      const { count: restants } = await db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", moi);
      return NextResponse.json({ desabonne: (retirees ?? []).length > 0, restants: restants ?? 0, cout: 0 });
    }

    // ── « Envoie-moi maintenant » : l'élève se notifie lui-même, jamais un tiers ──
    if (mode === "notifier") {
      const { data: subs, error } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", moi);
      if (error) return refus("Lecture des abonnements refusée : " + error.message, 500);
      const maintenant = Date.now();
      const { count: du } = await db
        .from("review_cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", moi)
        .lte("due_at", new Date(maintenant).toISOString());
      const { titre, corps } = messageRappel(du ?? 0);
      const r = await notifier(db as any, (subs ?? []) as Abonnement[], titre, corps, "/app/thunder");
      return NextResponse.json({
        abonnements_trouves: (subs ?? []).length,
        ...r,
        cartes_dues: du ?? 0,
        message: r.envoyees ? "Un message part vers ce navigateur." : (r.purges ? "Abonnements morts supprimés, rien envoyé." : "Rien envoyé : ouvre l'interrupteur « préviens-moi » et autorise la notification."),
        cout: 0,
      });
    }

    return refus("Mode non géré.", 500);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "erreur inconnue";
    return NextResponse.json({ error: "Révisions indisponibles : " + message.slice(0, 160), cout: 0 }, { status: 500 });
  }
}

/** Le navigateur a besoin de la clé publique pour s'abonner : elle n'est pas secrète. */
export async function GET() {
  return NextResponse.json({
    cle_publique: vapidPublic() || null,
    possible: pushConfigure(),
    message: pushConfigure()
      ? "L'abonnement se fait par POST { mode: \"abonner\", subscription }."
      : "Notifications indisponibles : VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY ne sont pas dans l'environnement.",
    modes: MODES,
    credit: "Aucun mode de cette route ne débite de crédit : aucun appel de modèle n'y est fait.",
  });
}
