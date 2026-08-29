import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { todayUTC } from "@/lib/compte";
import { messageRappel, notifier, pushConfigure } from "@/lib/push";

/**
 * Le réveil. La base n'a pas de démon qui se lève tout seul, donc c'est `pg_cron`
 * (extension installée le 29/08/2026, mesurée dans `cron.job`) qui appelle CETTE route
 * chaque matin à 08:30 UTC, via `pg_net` — et `pg_net` sort vraiment vers le site :
 * vérifié le 29/08/2026, l'appel a traversé le réseau et la réponse est relue dans
 * `net._http_response`.
 *
 * Ce que la route fait, et rien d'autre :
 *  1. elle exige l'en-tête `x-rappel-secret` (constante comparée en temps constant) :
 *     sans lui, un inconnu pourrait faire pleuvoir des notifications sur les élèves ;
 *  2. elle ne retient que les comptes qui ont AU MOINS UNE carte à date ET un
 *     abonnement vivant, et dont la dernière notification n'a pas été envoyée aujourd'hui
 *     (le garde est relu en base, pas en mémoire : les fonctions serverless n'ont pas
 *     de mémoire) ;
 *  3. elle envoie un message sobre — un nombre de cartes, pas de motivation fabriquée.
 */
export const maxDuration = 60;

function autorise(req: Request): boolean {
  const attendu = (process.env.RAPPEL_SECRET ?? "").trim();
  if (attendu.length < 16) return false;
  const recu = String(req.headers.get("x-rappel-secret") ?? "");
  if (recu.length !== attendu.length) return false;
  try {
    return timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!autorise(req)) {
    return NextResponse.json({ error: "Secret de rappel manquant ou faux : cet appel est réservé à la base." }, { status: 403 });
  }
  if (!pushConfigure()) {
    return NextResponse.json({ error: "VAPID non configuré : aucun envoi possible." }, { status: 503 });
  }
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const maintenant = new Date().toISOString();
    const aujourdhui = todayUTC();
    const { data: abonnements, error: e1 } = await db
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, sent_at")
      .order("user_id", { ascending: true })
      .limit(2000);
    if (e1) return NextResponse.json({ error: "Lecture des abonnements refusée : " + e1.message }, { status: 500 });

    const parCompte = new Map<string, typeof abonnements>();
    for (const ab of abonnements ?? []) {
      // Déjà prévenu aujourd'hui → on ne double pas.
      if (String(ab.sent_at ?? "").slice(0, 10) === aujourdhui) continue;
      const liste = parCompte.get(ab.user_id) ?? [];
      liste.push(ab);
      parCompte.set(ab.user_id, liste);
    }

    let envoyees = 0;
    let purges = 0;
    let comptesVus = 0;
    let comptesSautes = 0;
    const erreurs: { motif: string; code?: number }[] = [];

    for (const [userId, subs] of parCompte) {
      comptesVus += 1;
      if (comptesVus > 300) { comptesSautes += 1; continue; } // un tour ne doit pas durer plus que le budget
      const { count: du } = await db
        .from("review_cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .lte("due_at", maintenant);
      if (!du) { comptesSautes += 1; continue; }
      const { titre, corps } = messageRappel(du);
      const r = await notifier(db, subs as any, titre, corps, "/app/thunder");
      envoyees += r.envoyees;
      purges += r.purges;
      erreurs.push(...r.erreurs.slice(0, 2));
    }

    return NextResponse.json({
      du: aujourdhui,
      comptes_avec_abonnement: parCompte.size,
      comptes_examines: comptesVus,
      notifications_envoyees: envoyees,
      abonnements_morts_supprimes: purges,
      comptes_sans_carte_du: comptesSautes,
      erreurs: erreurs.slice(0, 5),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: "Rappel interrompu : " + (e instanceof Error ? e.message.slice(0, 160) : "erreur") }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    role: "réveil des rappels de révision",
    declencheur: "pg_cron via pg_net, chaque jour à 08:30 UTC",
    appel: "POST avec l'en-tête x-rappel-secret",
  });
}
