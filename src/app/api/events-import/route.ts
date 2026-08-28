import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const CATEGORY_COLORS: Record<string, string> = {
  exam:     '#ff4757',
  homework: '#ffa502',
  meeting:  '#a78bfa',
  trip:     '#2ed573',
  sport:    '#00D2B6',
  reminder: '#FFD700',
  general:  '#2e5bff',
};

// Jeton d'accès : en-tête `Authorization: Bearer <access_token>` en priorité,
// puis `authToken` dans le corps JSON (la forme historique de l'app est conservée).
function tokenFrom(req: Request, body: any): string {
  const h = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return h || (typeof body?.authToken === 'string' ? body.authToken : '');
}

export async function POST(req: Request) {
  try {
    const { entries, authToken } = await req.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "Aucun événement à importer" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${tokenFrom(req, { authToken })}` } }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Utilisateur non authentifié" }, { status: 401 });

    const rows = entries.map((e: any) => ({
      user_id: user.id,
      title: e.title,
      description: e.description || '',
      event_date: e.event_date,
      event_time: e.event_time || '',
      category: e.category || 'general',
      color: CATEGORY_COLORS[e.category as string] || CATEGORY_COLORS.general || '#2e5bff',   // #2e5bff = la valeur de `general` ci-dessus, répété pour que le repli ne soit pas une teinte inventée
    }));

    const { data, error } = await supabase.from('events').insert(rows).select();
    // Bug #3 fix: handle missing table gracefully
    if (error) {
      const isMissingTable = error.message?.includes('relation') && error.message?.includes('does not exist');
      if (isMissingTable) {
        return NextResponse.json({ 
          error: "La table 'events' n'existe pas encore. Exécutez le fichier supabase/migrations/0002_events.sql dans votre éditeur SQL Supabase pour activer cette fonctionnalité.", 
          setupRequired: true 
        }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, inserted: data.length });

  } catch (error: any) {
    console.error("Events import error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
