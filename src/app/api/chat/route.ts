import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configuration Supabase (Côté Serveur)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggnwtszeitrrfhedgipv.supabase.co';

// Lazy client to prevent build errors
let supabaseAdmin: any = null;
function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!key) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is missing. Using anon client (build mode).");
    return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  }
  supabaseAdmin = createClient(supabaseUrl, key);
  return supabaseAdmin;
}

export const maxDuration = 45;

// FIX: les appels IA pouvaient pendre ~30 s et faire tuer la fonction par la
// plateforme (502). On borne chaque appel a 20 s, on retente une fois sur erreur
// reseau / timeout / 429 / 5xx, et on refuse de débiter sans réponse.
const AI_TIMEOUT_MS = 20000;
async function fetchWithTimeout(url: string, init: RequestInit, attempts = 2): Promise<Response> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(AI_TIMEOUT_MS) });
      const retriable = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
      if (!retriable || i === attempts - 1) return res;
    } catch (e: any) {
      lastErr = e;
      if (i === attempts - 1) throw e;
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("Appel IA échoué");
}

export async function POST(req: Request) {
  try {
    const { messages, system } = await req.json();
    const supabase = getSupabaseAdmin();

    // Identification de l'utilisateur
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: "Authentification requise pour utiliser l'IA." }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return NextResponse.json({ error: "Session invalide ou expirée." }, { status: 401 });
    }

    // Vérifier les crédits (créer le profil si absent — cas OAuth Google/Microsoft)
    let { data: userData } = await supabase
      .from('users')
      .select('tokens, role')
      .eq('id', user.id)
      .single();

    if (!userData) {
      const meta = user.user_metadata || {};
      const fullName = meta.full_name || meta.name || '';
      const firstName = fullName.split(' ')[0] || 'Utilisateur';
      const lastName = fullName.split(' ').slice(1).join(' ') || '';
      const { data: created } = await supabase.from('users').upsert({
        id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        role: 'normal',
        tokens: 100
      }).select('tokens, role').single();
      userData = created || { tokens: 100, role: 'normal' };
    }

    if (!userData) {
      return NextResponse.json({ error: "Impossible de charger le profil utilisateur." }, { status: 500 });
    }

    const isUnlimited = ['founder', 'moderator'].includes(userData.role);

    if (!isUnlimited && userData.tokens <= 0) {
      return NextResponse.json({
        response: "🚫 **Attention : Plus de crédits !** Vos tokens se rechargent automatiquement. Revenez plus tard."
      }, { status: 402 });
    }

    // === PRIORITÉ : GOOGLE GEMINI (confirmé actif) → FALLBACK : GROQ ===
    const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';
    const GROQ_KEY = process.env.GROQ_API_KEY ?? '';

    if (!GEMINI_KEY && !GROQ_KEY) {
      return NextResponse.json({
        error: "Aucune clé API trouvée. Configurez GEMINI_API_KEY ou GROQ_API_KEY dans les variables d'environnement Netlify."
      }, { status: 500 });
    }

    const currentDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const enhancedSystem = `${system || ""}\n\n[INFO] La date d'aujourd'hui est le ${currentDate}. Tu es Moncef IA.`;
    // FIX: avant, l'enchaînement était `if (GEMINI_KEY) { ... } else if (GROQ_KEY) {...}`
    // → Groq n'était appelé QUE si GEMINI_API_KEY était absente de Netlify. Comme la
    // clé Gemini est en place, le secours ne s'exécutait jamais : un timeout ou un 429
    // de Google faisait `throw`, on sautait directement au catch, et l'utilisateur
    // avait une erreur alors qu'un second fournisseur était payé et disponible.
    // Les fournisseurs sont maintenant essayés en ordre jusqu'au premier qui répond.
    const providers: { name: string; run: () => Promise<string> }[] = [];

    if (GEMINI_KEY) {
      providers.push({
        name: 'Gemini',
        run: async () => {
          const geminiContents = messages.map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: Array.isArray(m.content)
              ? m.content.map((p: any) => {
                  if (p.type === 'text') return { text: p.text };
                  if (p.type === 'image_url') {
                    const dataUrl: string = p.image_url?.url || '';
                    const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
                    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                    const base64Data = dataUrl.split(',')[1] || '';
                    return { inlineData: { mimeType, data: base64Data } };
                  }
                  return { text: '' };
                })
              : [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
          }));

          const response = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: enhancedSystem }] },
                contents: geminiContents
              })
            }
          );

          const data = await response.json();
          if (!response.ok) {
            console.error("Gemini API Error:", JSON.stringify(data));
            throw new Error(data.error?.message || `Erreur Gemini (${response.status})`);
          }
          return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        },
      });
    }

    if (GROQ_KEY) {
      providers.push({
        name: 'Groq',
        run: async () => {
          const aiMessages = [
            { role: 'system', content: enhancedSystem },
            ...messages.map((m: any) => ({
              role: m.role,
              content: Array.isArray(m.content)
                ? m.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') || '(image envoyée)'
                : (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
            }))
          ];

          const response = await fetchWithTimeout(`https://api.groq.com/openai/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${GROQ_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              // FIX: "llama-3.1-8b-instant" n'existe plus chez Groq (model_not_found).
              // gpt-oss-20b est le modèle de chat rapide encore joignable ; il consomme
              // des reasoning_tokens, d'où 8192 (à 2048 la réponse était tronquée,
              // finish=length mesuré sur un vrai prompt).
              model: "openai/gpt-oss-20b",
              messages: aiMessages,
              max_tokens: 8192,
              temperature: 0.7
            })
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error?.message || `Erreur Groq (${response.status})`);
          }
          return data.choices?.[0]?.message?.content || "";
        },
      });
    }

    if (providers.length === 0) {
      // FIX: sans clé IA configurée, la fonction renvoyait 200 avec une réponse
      // VIDE tout en débitant 10 crédits. On refuse explicitement la requête.
      return NextResponse.json(
        { error: "Aucun fournisseur d'IA n'est configuré (GEMINI_API_KEY / GROQ_API_KEY manquants)." },
        { status: 503 }
      );
    }

    let assistantMessage = "";
    const failures: string[] = [];
    for (const provider of providers) {
      try {
        const text = (await provider.run()).trim();
        if (text) {
          assistantMessage = text;
          break;
        }
        failures.push(`${provider.name}: réponse vide`);
      } catch (e: any) {
        failures.push(`${provider.name}: ${e?.message || 'erreur inconnue'}`);
        console.error(`[chat] ${provider.name} a échoué, tentative du fournisseur suivant:`, e?.message);
      }
    }

    if (!assistantMessage) {
      // Aucun fournisseur n'a répondu : on ne débite PAS les crédits.
      return NextResponse.json(
        { error: "Les modèles d'IA sont momentanément indisponibles.", details: failures.join(' | ') },
        { status: 502 }
      );
    }

    // Déduction des crédits
    let newTokens = userData.tokens;
    if (!isUnlimited) {
      newTokens = Math.max(0, userData.tokens - 10);
      await supabase.from('users').update({ tokens: newTokens }).eq('id', user.id);
    }

    return NextResponse.json({ response: assistantMessage, newTokens });

  } catch (error: any) {
    console.error("API Chat Error:", error.message);
    return NextResponse.json({
      error: "Une erreur est survenue lors de la communication avec l'IA.",
      details: error.message
    }, { status: 500 });
  }
}
