import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req) {
  try {
    const { entries, authToken } = await req.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "Aucun devoir à importer" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authToken}` } }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Utilisateur non authentifié" }, { status: 401 });
    }

    const toInsert = entries.filter(e => !e.id);
    const toUpdate = entries.filter(e => !!e.id);

    let inserted = 0;
    let updated = 0;

    // Insert new homework
    if (toInsert.length > 0) {
      const rows = toInsert.map(e => ({
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
      const updates = {};
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

  } catch (error) {
    console.error("Homework import error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
