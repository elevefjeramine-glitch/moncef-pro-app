import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configuration Supabase (Côté Serveur)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggnwtszeitrrfhedgipv.supabase.co';

// Lazy client to prevent build errors
let supabaseAdmin: any = null;
function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is missing. Using anon client (build mode).");
    return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  }
  supabaseAdmin = createClient(supabaseUrl, key);
  return supabaseAdmin;
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
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GROQ_KEY = process.env.GROQ_API_KEY;

    if (!GEMINI_KEY && !GROQ_KEY) {
      return NextResponse.json({
        error: "Aucune clé API trouvée. Configurez GEMINI_API_KEY ou GROQ_API_KEY dans les variables d'environnement Netlify."
      }, { status: 500 });
    }

    const currentDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const enhancedSystem = `${system || ""}\n\n[INFO] La date d'aujourd'hui est le ${currentDate}. Tu es Moncef IA.`;

    let assistantMessage = "";

    if (GEMINI_KEY) {
      // ✅ Google Gemini 3.6 Flash — modèle actif et confirmé fonctionnel
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
          : [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
      }));

      const response = await fetch(
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

      assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || "Désolé, je n'ai pas pu générer une réponse.";

    } else if (GROQ_KEY) {
      // Fallback Groq — utiliser un modèle stable
      const aiMessages = [
        { role: 'system', content: enhancedSystem },
        ...messages.map((m: any) => ({
          role: m.role,
          content: Array.isArray(m.content)
            ? m.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') || '(image envoyée)'
            : (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
        }))
      ];

      const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: aiMessages,
          max_tokens: 2048,
          temperature: 0.7
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `Erreur Groq (${response.status})`);
      }
      assistantMessage = data.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer une réponse.";
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
