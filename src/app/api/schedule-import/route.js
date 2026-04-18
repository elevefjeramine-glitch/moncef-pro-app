import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req) {
  try {
    const { entries, action, authToken } = await req.json();

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authToken}` } }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Utilisateur non authentifié" }, { status: 401 });

    // ---- INSERT (default / image import) ----
    if (!action || action === 'insert') {
      if (!entries || entries.length === 0)
        return NextResponse.json({ error: "Aucune entrée à importer" }, { status: 400 });

      const rows = entries.map(e => ({
        user_id: user.id,
        week: e.week || 'A',
        day_index: e.day_index,
        subj: e.subj,
        time_slot: e.time_slot || ''
      }));

      const { data, error } = await supabase.from('schedule').insert(rows).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, inserted: data.length, action: 'insert' });
    }

    // ---- DELETE ----
    if (action === 'delete') {
      const ids = entries.map(e => e.id).filter(Boolean);
      if (ids.length === 0) return NextResponse.json({ error: "Aucun ID à supprimer" }, { status: 400 });

      let deleted = 0;
      for (const id of ids) {
        const { error } = await supabase.from('schedule').delete().eq('id', id).eq('user_id', user.id);
        if (!error) deleted++;
      }
      return NextResponse.json({ success: true, deleted, action: 'delete' });
    }

    // ---- UPDATE ----
    if (action === 'update') {
      if (!entries || entries.length === 0)
        return NextResponse.json({ error: "Aucune modification" }, { status: 400 });

      let updated = 0;
      for (const e of entries) {
        if (!e.id) continue;
        const updates = {};
        if (e.subj !== undefined) updates.subj = e.subj;
        if (e.time_slot !== undefined) updates.time_slot = e.time_slot;
        if (e.day_index !== undefined) updates.day_index = e.day_index;
        if (e.week !== undefined) updates.week = e.week;
        if (Object.keys(updates).length === 0) continue;

        const { error } = await supabase.from('schedule').update(updates).eq('id', e.id).eq('user_id', user.id);
        if (!error) updated++;
      }
      return NextResponse.json({ success: true, updated, action: 'update' });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });

  } catch (error) {
    console.error("Schedule import error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
