import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configuration Supabase (Côté Serveur)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggnwtszeitrrfhedgipv.supabase.co';

// Lazy client to prevent build errors
let supabaseAdmin = null;
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

export async function POST(req) {
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

    // Vérifier les crédits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tokens, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "Utilisateur non trouvé en base." }, { status: 404 });
    }

    const isUnlimited = ['founder', 'moderator'].includes(userData.role);
    
    if (!isUnlimited && userData.tokens <= 0) {
      return NextResponse.json({ 
        response: "🚫 **Attention : Plus de crédits !** Vos tokens se rechargent automatiquement. Revenez plus tard." 
      }, { status: 402 });
    }

    // === GOOGLE GEMINI OR GROQ API INTEGRATION ===
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GROQ_KEY = process.env.GROQ_API_KEY;
    
    if (!GEMINI_KEY && !GROQ_KEY) {
      return NextResponse.json({ 
        error: "Aucune clé API trouvée. Veuillez vérifier votre fichier .env.local (GROQ_API_KEY ou GEMINI_API_KEY)." 
      }, { status: 500 });
    }

    const currentDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const enhancedSystem = `${system || ""}\n\n[INFO CONTEXTUELLE] La date d'aujourd'hui est le ${currentDate}. Tu es Moncef IA.`;

    let assistantMessage = "";

    if (GROQ_KEY) {
      // 🚀 Utilisation de Groq (Llama 3)
      const aiMessages = [
        { role: 'system', content: enhancedSystem },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ];

      const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile", // Modèle ultra-rapide et intelligent
          messages: aiMessages
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Erreur de communication avec Groq");
      }
      assistantMessage = data.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer une réponse.";
    } else {
      // 🚀 Utilisation de Google Gemini
      const geminiContents = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: enhancedSystem }] },
          contents: geminiContents
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Gemini API Error:", data);
        if (data.error?.message?.includes("API key not valid")) {
          throw new Error("La clé API Gemini est invalide ou expirée.");
        } else if (data.error?.status === "PERMISSION_DENIED") {
          throw new Error("Votre compte Google a été bloqué pour l'utilisation de l'API. Veuillez utiliser une clé GROQ.");
        }
        throw new Error(data.error?.message || "Erreur de communication avec Google Gemini");
      }
      assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || "Désolé, je n'ai pas pu générer une réponse.";
    }

    // Déduction des crédits
    let newTokens = userData.tokens;
    if (!isUnlimited) {
      newTokens = Math.max(0, userData.tokens - 10);
      await supabase
        .from('users')
        .update({ tokens: newTokens })
        .eq('id', user.id);
    }

    return NextResponse.json({ 
      response: assistantMessage,
      newTokens: newTokens
    });

  } catch (error) {
    console.error("API Chat Error:", error.message);
    return NextResponse.json({ 
      error: "Une erreur est survenue lors de la communication avec l'IA.",
      details: error.message 
    }, { status: 500 });
  }
}
