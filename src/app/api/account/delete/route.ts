import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DELETION_GRACE_DAYS, deletionDeadline, makeAdminClient } from '@/lib/compte';

// Suppression du compte à la demande de l'utilisateur, avec délai de
// rétractation (choix produit : 7 jours, annulables).
//
//   POST /api/account/delete                 -> programme la suppression
//   POST /api/account/delete  { "cancel": true } -> annule la demande
//   GET  /api/account/delete                 -> lit l'état (date d'échéance ou null)
//
// Authentification : en-tête `Authorization: Bearer <access_token>` (la forme
// propre) ou, par compatibilité avec l'existant, `authToken` dans le corps.
// L'exécution a lieu plus tard : voir src/lib/compte.ts et le paragraphe
// « quand est-elle exécutée » de /api-docs.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggnwtszeitrrfhedgipv.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function authenticate(req: Request) {
  let token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    // Les routes d'import de l'app passent le jeton dans le corps : on
    // l'accepte ici aussi, pour ne pas casser un client déjà écrit.
    try {
      const body = await req.json();
      if (typeof body?.authToken === 'string') token = body.authToken;
      return { token, body: body ?? {} };
    } catch {
      return { token: '', body: {} };
    }
  }
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return { token, body };
}

async function caller(req: Request) {
  const { token, body } = await authenticate(req);
  if (!token) {
    return { error: NextResponse.json({ error: 'Jeton manquant : en-tête Authorization: Bearer requis.' }, { status: 401 }) };
  }
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Session invalide ou expirée.' }, { status: 401 }) };
  }
  return { user, body };
}

export async function GET(req: Request) {
  const ctx = await caller(req);
  if (ctx.error) return ctx.error;

  const admin = makeAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('role, deletion_scheduled_at')
    .eq('id', ctx.user!.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    deletionScheduledAt: data?.deletion_scheduled_at ?? null,
    graceDays: DELETION_GRACE_DAYS,
    role: data?.role ?? null,
  });
}

export async function POST(req: Request) {
  const ctx = await caller(req);
  if (ctx.error) return ctx.error;

  const admin = makeAdminClient();
  const { data: profile, error: readError } = await admin
    .from('users')
    .select('role, email, deletion_scheduled_at')
    .eq('id', ctx.user!.id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  // Annulation : il n'y a rien à purger, on remet simplement la colonne à NULL.
  if (ctx.body?.cancel === true) {
    const { error } = await admin.from('users').update({ deletion_scheduled_at: null }).eq('id', ctx.user!.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, cancelled: true, deletionScheduledAt: null });
  }

  // La demande doit être explicitement confirmée : un simple POST distrait ne
  // doit pas lancer une suppression de compte.
  if (ctx.body?.confirm !== true) {
    return NextResponse.json(
      {
        error: `Confirmation requise : envoyez { "confirm": true } pour programmer la suppression définitive dans ${DELETION_GRACE_DAYS} jours.`,
        graceDays: DELETION_GRACE_DAYS,
      },
      { status: 400 }
    );
  }

  const scheduledFor = deletionDeadline();
  const { error } = await admin
    .from('users')
    .update({ deletion_scheduled_at: scheduledFor })
    .eq('id', ctx.user!.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const warnings: string[] = [];
  if (profile?.role === 'founder') {
    warnings.push("Ce compte porte le rôle founder : tant qu'il n'est pas supprimé, il garde l'accès au panneau Alpha.");
  }
  if (profile?.role === 'moderator') {
    warnings.push("Ce compte porte le rôle moderator : il peut lire les données d'autres comptes via le panneau Alpha.");
  }
  if (!profile) {
    warnings.push("Aucune ligne public.users pour ce compte : seule l'authentification sera supprimée à l'échéance.");
  }

  return NextResponse.json({
    success: true,
    scheduled: true,
    deletionScheduledAt: scheduledFor,
    graceDays: DELETION_GRACE_DAYS,
    cancelsWith: { method: 'POST', path: '/api/account/delete', body: { cancel: true } },
    willDelete: [
      'profil (public.users)',
      'devoirs (homework)',
      'emploi du temps (schedule)',
      'événements (events)',
      'messages envoyés et reçus (user_messages)',
      'conversations et messages de messagerie',
      'identités OAuth, sessions et facteurs MFA (auth.*)',
    ],
    warnings,
  });
}
