/**
 * Web Push, sans service externe : la clé privée VAPID vit dans l'environnement de
 * Netlify, l'abonnement de l'élève dans `public.push_subscriptions`.
 *
 * Deux règles qu'on ne négocie pas :
 *  • une souscription « morte » (le push service répond 404 ou 410) est SUPPRIMÉE, pas
 *    gardée silencieuse : un abonnement qui ne livre plus ne doit pas rester en base ;
 *  • on n'envoie jamais deux fois le même jour : le jour de la dernière envoi est relu
 *    en base, pas retenu en mémoire (les fonctions serverless n'ont pas de mémoire).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Abonnement = { id: string; endpoint: string; p256dh: string; auth: string };

export function pushConfigure(): boolean {
  return (
    (process.env.VAPID_PUBLIC_KEY ?? "").trim().length > 30 &&
    (process.env.VAPID_PRIVATE_KEY ?? "").trim().length > 30
  );
}

export function vapidPublic(): string {
  return (process.env.VAPID_PUBLIC_KEY ?? "").trim();
}

type ResultatEnvoi = { envoyees: number; purges: number; erreurs: { motif: string; code?: number }[] };

/**
 * Envoie à chaque abonnement, purge les morts, renvoie des COMPTEURS (jamais le
 * détail des élèves). `db` doit être le client de service : l'écriture des
 * abonnements traverse la RLS volontairement.
 */
export async function notifier(db: SupabaseClient, abonnements: Abonnement[], titre: string, corps: string, url: string): Promise<ResultatEnvoi> {
  const res: ResultatEnvoi = { envoyees: 0, purges: 0, erreurs: [] };
  if (!pushConfigure()) {
    res.erreurs.push({ motif: "VAPID non configuré (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absentes de l'environnement)." });
    return res;
  }
  let webpush: any;
  try {
    webpush = await import("web-push");
    webpush = webpush.default ?? webpush;
  } catch (e: unknown) {
    res.erreurs.push({ motif: "module web-push indisponible : " + (e instanceof Error ? e.message.slice(0, 80) : "erreur") });
    return res;
  }
  webpush.setVapidDetails(
    (process.env.VAPID_SUBJECT ?? "mailto:admin@proappmoncef.netlify.app").trim(),
    vapidPublic(),
    (process.env.VAPID_PRIVATE_KEY ?? "").trim()
  );
  const payload = JSON.stringify({ titre, corps, url });
  for (const ab of abonnements) {
    try {
      await webpush.sendNotification(
        { endpoint: ab.endpoint, keys: { p256dh: ab.p256dh, auth: ab.auth } },
        payload,
        { TTL: 3600 }
      );
      res.envoyees += 1;
      await db.from("push_subscriptions").update({ sent_at: new Date().toISOString(), last_error: null }).eq("id", ab.id);
    } catch (e: any) {
      const code = Number(e?.statusCode ?? 0);
      if (code === 404 || code === 410) {
        await db.from("push_subscriptions").delete().eq("id", ab.id);
        res.purges += 1;
      } else {
        res.erreurs.push(code ? { motif: String(e?.message ?? "envoi refusé").slice(0, 90), code } : { motif: String(e?.message ?? "envoi refusé").slice(0, 90) });
        await db.from("push_subscriptions").update({ last_error: String(e?.message ?? "envoi refusé").slice(0, 200) }).eq("id", ab.id);
      }
    }
  }
  return res;
}

/** Le texte du rappel — écrit sobrement, sans exhortation ni emoji de motivation. */
export function messageRappel(du: number): { titre: string; corps: string } {
  return du > 0
    ? { titre: "Moncef IA — révisions", corps: `${du} ${du > 1 ? "cartes à revoir" : "carte à revoir"} aujourd'hui.` }
    : { titre: "Moncef IA — révisions", corps: "Rien de dû aujourd'hui. La prochaine carte a une date, pas toi à la chercher." };
}
