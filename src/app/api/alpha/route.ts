import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { purgeDueDeletions } from '@/lib/compte';
import { LIMITE_CORPS, lireJson, reponse413, rejeterSiAnnonceTropGrosse } from '@/lib/corps';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// Admin client with service role (bypasses RLS)
function getAdminClient() {
  if (!serviceRoleKey) throw new Error('Service role key not configured');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function POST(req: Request) {
  // Le corps est annoncé avant d'être lu : le panneau Alpha n'a aucune raison de
  // recevoir plus qu'un tableau d'identifiants, et le catch du bas renverrait un 500
  // technique sur un payload démesuré.
  const tropGrosse = rejeterSiAnnonceTropGrosse(req, LIMITE_CORPS.alpha);
  if (tropGrosse) return tropGrosse;
  try {
    const { action, authToken, payload } = await lireJson(req, LIMITE_CORPS.alpha);

    // Verify the requesting user is a founder using their session
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
      global: { headers: { Authorization: `Bearer ${authToken}` } }
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

        // Vérification du rôle côté serveur : la colonne `role` n'est plus lisible
    // par le rôle `authenticated`, donc on lit avec le client admin (service_role),
    // après avoir validé la session ci-dessus. Échec fermé si la clé manque.
    let profile: { role: string } | null = null;
    try {
      const adminClient = getAdminClient();
      const res = await adminClient.from('users').select('role').eq('id', user.id).single();
      profile = res.data;
    } catch (adminErr: any) {
      return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 503 });
    }
    if (!['founder', 'moderator'].includes(profile?.role ?? '')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const admin = getAdminClient();

    switch (action) {
      case 'GET_STATS': {
        const [users, homework, messages, schedule, deletionsDue] = await Promise.all([
          admin.from('users').select('id, email, first_name, last_name, role, tokens, created_at', { count: 'exact' }),
          admin.from('homework').select('id, subject, status, priority, user_id', { count: 'exact' }),
          admin.from('user_messages').select('id', { count: 'exact' }),
          admin.from('schedule').select('id', { count: 'exact' }),
          // Comptes dont le délai de 7 jours est écoulé : à purger via PURGE_DUE_DELETIONS.
          admin.from('users').select('id', { count: 'exact', head: true })
            .not('deletion_scheduled_at', 'is', null)
            .lte('deletion_scheduled_at', new Date().toISOString()),
        ]);
        return NextResponse.json({
          users: { count: users.count, data: users.data },
          homework: { count: homework.count, data: homework.data },
          messages: { count: messages.count },
          schedule: { count: schedule.count },
          deletions: { due: deletionsDue.count ?? 0 },
        });
      }

      case 'GET_USERS': {
        const { data, error } = await admin.from('users').select('*').order('created_at', { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
      }

      case 'UPDATE_USER': {
        const { userId, updates } = payload;
        if (profile?.role === 'moderator') {
          const { data: targetProfile } = await admin.from('users').select('role').eq('id', userId).single();
          if (targetProfile?.role !== 'normal' || updates.role === 'founder' || updates.role === 'moderator') {
            return NextResponse.json({ error: "Les modérateurs ne peuvent modifier que les comptes utilisateurs normaux, et ne peuvent pas attribuer de grades modérateurs ou fondateurs." }, { status: 403 });
          }
        }
        const allowed = ['role', 'tokens', 'first_name', 'last_name'];
        const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
        const { error } = await admin.from('users').update(safe).eq('id', userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      case 'DELETE_USER': {
        const { userId } = payload;
        if (profile?.role === 'moderator') {
          const { data: targetProfile } = await admin.from('users').select('role').eq('id', userId).single();
          if (targetProfile?.role !== 'normal') {
            return NextResponse.json({ error: "Les modérateurs ne peuvent supprimer que les comptes utilisateurs normaux." }, { status: 403 });
          }
        }
        
        // 1. Force delete all related records to avoid Foreign Key constraints
        await Promise.all([
          admin.from('homework').delete().eq('user_id', userId),
          admin.from('schedule').delete().eq('user_id', userId),
          // user_messages n'a pas de colonne user_id (colonnes réelles : id, sender_id,
          // receiver_id, content, created_at) : le filtre précédent échouait en silence.
          admin.from('user_messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
          admin.from('conversation_messages').delete().eq('sender_id', userId),
          admin.from('conversation_members').delete().eq('user_id', userId),
          admin.from('conversations').delete().eq('created_by', userId),
          admin.from('events').delete().eq('user_id', userId)
        ]);

        // 2. Delete public profile
        await admin.from('users').delete().eq('id', userId);

        // 3. Delete auth user
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        
        return NextResponse.json({ success: true });
      }

      case 'GET_ALL_HOMEWORK': {
        const { data, error } = await admin.from('homework').select('*, users(first_name, last_name, email)').order('created_at', { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data });
      }

      case 'DELETE_HOMEWORK': {
        const { hwId } = payload;
        const { error } = await admin.from('homework').delete().eq('id', hwId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      case 'RESET_TOKENS': {
        const { userId, amount } = payload;
        const { error } = await admin.from('users').update({ tokens: amount ?? 700 }).eq('id', userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      case 'PURGE_DUE_DELETIONS': {
        // Exécute la file d'attente des suppressions arrivées à échéance. Sans cron
        // côté base (pg_cron non installé), c'est cette action — ou le premier appel
        // /api/chat du concerné — qui fait réellement la purge.
        const { purged, failed } = await purgeDueDeletions(admin);
        return NextResponse.json({ success: failed.length === 0, purged, failed });
      }

      default:
        return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }

  } catch (error: any) {
    const refus = reponse413(error);
    if (refus) return refus;
    console.error('Alpha API error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
