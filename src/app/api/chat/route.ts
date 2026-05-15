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

// Bug #15 fix: Simple in-memory rate limiter
// 20 requests per user per 10 minutes
const rateLimitMap = new Map(); // token_hash -> { count, resetAt }
const LIMIT = 20;
const WINDOW_MS = 10 * 60 * 1000; // 10 min

function checkRateLimit(identifier) {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}

// Periodically clean old entries to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

export async function POST(req) {
  try {
    const { messages, system } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Configuration API manquante. Ajoutez GEMINI_API_KEY." }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();

    // Identification de l'utilisateur via le header Authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: "Authentification requise pour utiliser l'IA." }, { status: 401 });
    }

    // Récupérer l'ID utilisateur à partir du JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return NextResponse.json({ error: "Session invalide ou expirée." }, { status: 401 });
    }

    // Vérifier les crédits en base de données
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
        response: "🚫 **Attention : Plus de crédits !** Vos tokens se recharge automatiquement toutes les 2 heures. Revenez plus tard ou contactez l'admin." 
      }, { status: 402 });
    }

    // --- GOOGLE GEMINI INTEGRATION ---
    const currentDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const enhancedSystem = `${system || ""}\n\n[INFO CONTEXTUELLE] La date d'aujourd'hui est le ${currentDate}.`;

    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: geminiMessages,
        systemInstruction: {
          parts: [{ text: enhancedSystem }]
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API Error:", errorData);
      throw new Error(errorData.error?.message || "Erreur de communication avec Google Gemini");
    }

    const data = await response.json();
    const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur: Pas de réponse générée.";

    // Déduction des crédits (sauf si illimité)
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
