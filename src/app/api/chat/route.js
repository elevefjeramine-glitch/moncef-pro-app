import { NextResponse } from 'next/server';

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
    const { model, messages, system } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY is missing in environment variables.");
      return NextResponse.json({ 
        response: "🤖 Mode Démo : La clé API n'est pas configurée. Veuillez vérifier votre fichier .env.local." 
      }, { status: 200 });
    }

    // Bug #15 fix: Rate limit by Authorization header (user-specific)
    const authHeader = req.headers.get('authorization') || 
                       (messages?.[0]?.content ? messages[0].content.substring(0, 20) : 'anon');
    const identifier = `user:${authHeader.substring(0, 40)}`;
    if (!checkRateLimit(identifier)) {
      return NextResponse.json({ 
        response: "⏳ Trop de requêtes. Veuillez attendre quelques minutes avant de continuer." 
      }, { status: 429 });
    }

    // Bug #16 fix: model name centralized here, not duplicated across files
    const activeModel = 'claude-sonnet-4-20250514';
    
    const currentDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const enhancedSystem = `${system || ""}\n\n[INFO CONTEXTUELLE] La date d'aujourd'hui est le ${currentDate}.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: activeModel,
        max_tokens: 4096,
        messages: messages,
        system: enhancedSystem
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Anthropic API Error:", errorData);
      throw new Error(errorData.error?.message || "Erreur de communication avec Anthropic");
    }

    const data = await response.json();
    return NextResponse.json({ 
      response: data.content[0].text 
    });

  } catch (error) {
    console.error("API Chat Error:", error.message);
    return NextResponse.json({ 
      error: "Une erreur est survenue lors de la communication avec l'IA.",
      details: error.message 
    }, { status: 500 });
  }
}
