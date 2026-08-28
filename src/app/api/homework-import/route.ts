import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LIMITE_CORPS, lireJson, reponse413, rejeterSiAnnonceTropGrosse } from '@/lib/corps';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Jeton d'accès : en-tête `Authorization: Bearer <access_token>` en priorité,
// puis `authToken` dans le corps JSON (la forme historique de l'app est conservée).
function tokenFrom(req: Request, body: any): string {
  const h = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return h || (typeof body?.authToken === 'string' ? body.authToken : '');
}

export async function POST(req: Request) {
  const tropGrosse = rejeterSiAnnonceTropGrosse(req, LIMITE_CORPS.import);
  if (tropGrosse) return tropGrosse;
  try {
    const { entries, authToken } = await lireJson(req, LIMITE_CORPS.import);

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "Aucun devoir à importer" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${tokenFrom(req, { authToken })}` } }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Utilisateur non authentifié" }, { status: 401 });
    }

    const toInsert = entries.filter((e: any) => !e.id);
    const toUpdate = entries.filter((e: any) => !!e.id);

    let inserted = 0;
    let updated = 0;

    // Insert new homework
    if (toInsert.length > 0) {
      const rows = toInsert.map((e: any) => ({
        user_id: user.id,
        subject: e.subject,
        task: e.task,
        teacher: e.teacher || '',
        priority: e.priority || 'normal',
        status: e.status || 'todo',
        progression: e.progression ?? 0,
        due_date: e.due_date || null,
        is_done: false
      }));
      const { data, error } = await supabase.from('homework').insert(rows).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      inserted = data.length;
    }

    // Update existing homework (due_date, progression, status)
    for (const e of toUpdate) {
      const updates: Record<string, any> = {};
      if (e.due_date !== undefined) updates.due_date = e.due_date || null;
      if (e.progression !== undefined) updates.progression = e.progression;
      if (e.status !== undefined) {
        updates.status = e.status;
        updates.is_done = e.status === 'done';
        if (e.status === 'done') updates.progression = 100;
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('homework').update(updates).eq('id', e.id).eq('user_id', user.id);
        if (!error) updated++;
      }
    }

    return NextResponse.json({ success: true, inserted, updated });

  } catch (error: any) {
  const refus = reponse413(error);
      if (refus) return refus;

    console.error("Homework import error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
