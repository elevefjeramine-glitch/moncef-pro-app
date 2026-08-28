import { NextResponse } from 'next/server';

// Sonde de santé réelle : chaque chiffre renvoyé ici est mesuré pendant la
// requête. Aucun taux de disponibilité, aucune latence moyenne, aucun
// historique n'est inventé — la page /status se contente d'afficher ce que
// cette route a observé, plus ce que le navigateur a mesuré de son côté.
//
// Ce qui n'est PAS testé, volontairement : un appel réel au modèle IA. Il
// coûterait des crédits et ajouterait ~2 s ; on renvoie donc seulement si la
// configuration est présente, et c'est écrit dans le libellé.

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggnwtszeitrrfhedgipv.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const PROBE_TIMEOUT_MS = 3000;

type Check = {
  key: string;
  label: string;
  ok: boolean;
  latencyMs: number | null;
  detail: string;
};

async function probe(url: string, headers: Record<string, string>): Promise<{ ok: boolean; latencyMs: number; detail: string }> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const latencyMs = Date.now() - started;
    // On lit le corps tout petit : un fetch non consommé laisse la connexion
    // ouverte et fausse la mesure suivante.
    await res.text().catch(() => '');
    return { ok: res.ok, latencyMs, detail: `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - started, detail: e?.name === 'TimeoutError' ? `aucune réponse après ${PROBE_TIMEOUT_MS} ms` : e?.message ?? 'appel impossible' };
  }
}

export async function GET() {
  const checks: Check[] = [];
  const totalStart = Date.now();

  // 1. La base, côté serveur : PostgREST répond-il et vite ?
  const db = await probe(`${SUPABASE_URL}/rest/v1/users?select=id&limit=1`, {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'Range-Unit': 'items',
    Range: '0-0',
  });
  checks.push({
    key: 'database',
    label: 'Base de données (PostgREST)',
    ok: db.ok,
    latencyMs: db.latencyMs,
    detail: db.ok ? `${db.detail} en ${db.latencyMs} ms` : db.detail,
  });

  // 2. Le service d'authentification : c'est lui qui porte Google et le mot de passe.
  const auth = await probe(`${SUPABASE_URL}/auth/v1/health`, { apikey: ANON_KEY });
  checks.push({
    key: 'auth',
    label: "Authentification (GoTrue)",
    ok: auth.ok,
    latencyMs: auth.latencyMs,
    detail: auth.ok ? `${auth.detail} en ${auth.latencyMs} ms` : auth.detail,
  });

  // 3. Configuration IA : présence des clés, sans appeler le modèle.
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  const groq = Boolean(process.env.GROQ_API_KEY);
  checks.push({
    key: 'ai',
    label: 'Modèle IA',
    ok: gemini || groq,
    latencyMs: null,
    detail: `clé${gemini && groq ? 's' : ''} GEMINI_API_KEY${gemini ? ' et GROQ_API_KEY' : groq ? ' absente, GROQ_API_KEY présente' : ' absente'} — appel réel non effectué pour ne pas débiter de crédits`,
  });

  const degraded = checks.some((c) => !c.ok);

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'ok',
      observedAt: new Date().toISOString(),
      durationMs: Date.now() - totalStart,
      timeoutMs: PROBE_TIMEOUT_MS,
      checks,
      // Renseignements de déploiement, renvoyés tels quels s'ils existent
      // (injectés par Netlify au build), null sinon. Pas de mystification :
      // la version déployée est identifiable, l'uptime ne l'est pas.
      deployment: {
        commit: process.env.COMMIT_REF ? process.env.COMMIT_REF.slice(0, 7) : null,
        branch: process.env.BRANCH ?? null,
        buildId: process.env.BUILD_ID ?? null,
        context: process.env.CONTEXT ?? null,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
