import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();

    try {
      const response = await fetch("https://moncef-ia-proxy.eleve-fjer-amine.workers.dev/api/claude", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Origin": "https://elevefjeramine-glitch.github.io"
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.response) {
          return NextResponse.json(data);
        }
      }
    } catch (proxyError) {
      console.warn("Proxy echoué, passage en mode mock", proxyError.message);
    }

    // Mock fallback response
    const lastMsg = body.messages && body.messages.length > 0 ? body.messages[body.messages.length - 1].content : "";
    const isAlpha = body.system && body.system.includes("ALPHA");
    
    await new Promise(r => setTimeout(r, 1500));

    let reply = "";
    if (isAlpha) {
      reply = "👑 ALPHA AI : Commande reçue : \"" + lastMsg + "\". J'analyse les données de la plateforme. En tant qu'administrateur suprême, toutes vos requêtes sont prioritaires. Comment puis-je ajuster les paramètres aujourd'hui ?";
    } else {
      reply = "🤖 Moncef IA : Vous avez dit \"" + lastMsg + "\". Je suis actuellement en mode démo (le proxy est indisponible). Ne vous inquiétez pas, je suis conçu pour vous assister dans toutes vos questions pédagogiques !";
    }

    return NextResponse.json({ response: reply });
  } catch (error) {
    console.error("API Chat Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
