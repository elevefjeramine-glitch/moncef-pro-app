// Logique de cycle de vie d'un compte : plancher quotidien de crédits et
// suppression programmée avec délai. Centralisé ici parce que trois endroits
// doivent être d'accord : /api/chat, /api/account/delete et le panneau Alpha.
//
// Les chiffres et les colonnes de ce fichier viennent de mesures sur la base,
// pas d'une supposition :
//   - public.users.tokens_reset_at / deletion_scheduled_at : ajoutées par la
//     migration 0009 (appliquée le 2026-08-28, relecture information_schema OK).
//   - pg_cron n'est PAS installé sur ce projet (`SELECT count(*) FROM
//     pg_extension WHERE extname='cron'` -> 0) et reset_daily_tokens()
//     n'existe pas : le rechargement doit donc être déclenché dans le code.

import { createClient } from '@supabase/supabase-js';

/** Solde garanti chaque jour. Un compte plus riche n'est jamais raboté. */
export const DAILY_CREDIT_FLOOR = 700;

/** Délai de rétractation avant la suppression définitive. */
export const DELETION_GRACE_DAYS = 7;

/** Clé d'API de gestion, lue comme dans src/app/api/alpha/route.ts. */
export function makeAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggnwtszeitrrfhedgipv.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Date du jour en UTC, format YYYY-MM-DD (la colonne est de type `date`). */
export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Port le solde au plancher quotidien si ça n'a pas encore été fait aujourd'hui.
 * `Math.max` volontaire : on ne baisse jamais un solde (un modérateur à 8000 y
 * reste). Écrit avec le client de service, comme le reste de /api/chat.
 * Retourne le solde à utiliser pour la suite de la requête.
 */
export async function applyDailyCreditFloor(
  db: any,
  userId: string,
  profile: { tokens: number | null; tokens_reset_at?: string | null }
): Promise<number> {
  const today = todayUTC();
  const current = profile.tokens ?? 0;
  if (profile.tokens_reset_at === today) return current;

  const tokens = Math.max(current, DAILY_CREDIT_FLOOR);
  const { error } = await db
    .from('users')
    .update({ tokens, tokens_reset_at: today })
    .eq('id', userId);
  if (error) {
    // Un échec d'écriture ne doit pas empêcher la réponse IA : on renvoie le
    // solde lu, la remise à niveau sera retentée à l'appel suivant.
    console.error('applyDailyCreditFloor:', error.message);
    return current;
  }
  return tokens;
}

/**
 * Supprime réellement un compte et tout ce qui lui appartient.
 *
 * Ce qui est mesuré sur cette base (pg_constraint, 2026-08-28) :
 *   users.id             -> auth.users  ON DELETE CASCADE
 *   homework/schedule/events/user_messages/conversation_* -> users  ON DELETE CASCADE
 *   conversations.created_by -> users   ON DELETE SET NULL
 *
 * Donc la ligne `users` peut être supprimée sans vider les conversations : Postgres
 * détache le créateur (NULL). On exploite ce comportement volontairement ici, pour
 * la suppression *volontaire* : effacer un salon de groupe détruirait les messages
 * des autres membres, qui ne sont pas nos données à nous. (Le DELETE_USER de l'Alpha,
 * lui, supprime les salons créés — c'est un contexte de modération, pas un choix de
 * l'élève ; les deux politiques diffèrent donc délibérément.)
 */
export async function purgeAccount(admin: any, userId: string): Promise<{ ok: boolean; failed: string[] }> {
  const failed: string[] = [];

  const steps: Array<[string, () => Promise<{ error: { message: string } | null }>]> = [
    ['conversation_messages', () => admin.from('conversation_messages').delete().eq('sender_id', userId)],
    ['conversation_members', () => admin.from('conversation_members').delete().eq('user_id', userId)],
    ['homework', () => admin.from('homework').delete().eq('user_id', userId)],
    ['schedule', () => admin.from('schedule').delete().eq('user_id', userId)],
    ['events', () => admin.from('events').delete().eq('user_id', userId)],
    // user_messages n'a pas de colonne user_id (colonnes réelles : id, sender_id,
    // receiver_id, content, created_at) : d'où le filtre `or`, là où l'Alpha
    // filtrait sur une colonne inexistante et ignorait l'erreur.
    [
      'user_messages',
      () =>
        admin
          .from('user_messages')
          .delete()
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
    ],
    ['users', () => admin.from('users').delete().eq('id', userId)],
  ];

  for (const [label, run] of steps) {
    try {
      const { error } = await run();
      if (error) failed.push(`${label}: ${error.message}`);
    } catch (e: any) {
      failed.push(`${label}: ${e?.message ?? String(e)}`);
    }
  }

  // Le compte d'authentification en dernier : il porte identités, sessions,
  // facteurs MFA, et sa suppression fait CASCADE vers public.users (déjà vide).
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && !/not found/i.test(error.message)) failed.push(`auth.users: ${error.message}`);
  } catch (e: any) {
    failed.push(`auth.users: ${e?.message ?? String(e)}`);
  }

  return { ok: failed.length === 0, failed };
}

/**
 * Purge tous les comptes dont l'échéance de 7 jours est dépassée.
 * Appelé par /api/chat (au premier appel après l'échéance) et par l'action
 * Alpha PURGE_DUE_DELETIONS.
 */
export async function purgeDueDeletions(admin: any): Promise<{ purged: string[]; failed: string[] }> {
  const { data, error } = await admin
    .from('users')
    .select('id, email')
    .not('deletion_scheduled_at', 'is', null)
    .lte('deletion_scheduled_at', new Date().toISOString())
    .limit(50);

  if (error) return { purged: [], failed: [`lecture file d'attente: ${error.message}`] };

  const purged: string[] = [];
  const failed: string[] = [];
  for (const row of data ?? []) {
    const res = await purgeAccount(admin, row.id);
    if (res.ok) purged.push(row.email ?? row.id);
    else failed.push(`${row.email ?? row.id}: ${res.failed.join(' | ')}`);
  }
  return { purged, failed };
}

/** Date d'échéance pour une demande faite maintenant. */
export function deletionDeadline(from: Date = new Date()): string {
  return new Date(from.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
