import { NextResponse } from "next/server";

/**
 * Rate limiter par utilisateur pour les routes IA (Thunder, ALPHA).
 *
 * Pourquoi en mémoire et pas en base :
 * - aucune table Supabase existante n'est adaptée à un compteur par minute
 *   (vérifié le 04/10/2026 : users, homework, schedule, thunder_*, events…) ;
 * - créer une table exigerait une migration appliquée sur la base de prod,
 *   et un compteur DB ajouterait une lecture/écriture à CHAQUE appel IA ;
 * - le compteur de crédits quotidien existe déjà en base et reste la garde
 *   anti-facturation de fond — ce limiteur est le garde-fou par minute.
 *
 * Limites connues (assumées) : sur un hébergeur serverless, chaque instance
 * garde son propre compteur — ce n'est donc pas un plafond global parfait,
 * mais un frein efficace contre les rafales (compte compromis, boucle
 * cliente). Fenêtre glissante simple, nettoyage périodique, zéro dépendance.
 */

export const LIMITE_REQUETES_PAR_MINUTE = 20;
const FENETRE_MS = 60_000;

/** user.id (+ route) → horodatages des requêtes dans la fenêtre. */
const compteurs = new Map<string, number[]>();
let dernierNettoyage = 0;

function nettoyer(mtn: number): void {
  if (mtn - dernierNettoyage < FENETRE_MS) return;
  dernierNettoyage = mtn;
  const seuil = mtn - FENETRE_MS;
  for (const [cle, temps] of compteurs) {
    const frais = temps.filter((t) => t > seuil);
    if (frais.length) compteurs.set(cle, frais);
    else compteurs.delete(cle);
  }
}

export type ResultatLimite = { ok: true } | { ok: false; reessayerDans: number };

/**
 * Enregistre une requête pour `cle` (ex. `thunder:<user.id>`).
 * À appeler APRÈS l'authentification uniquement : jamais avant d'avoir
 * identifié l'utilisateur.
 */
export function verifierLimite(cle: string): ResultatLimite {
  const mtn = Date.now();
  nettoyer(mtn);
  const seuil = mtn - FENETRE_MS;
  const temps = (compteurs.get(cle) ?? []).filter((t) => t > seuil);
  if (temps.length >= LIMITE_REQUETES_PAR_MINUTE) {
    const plusAncien = Math.min(...temps);
    const reessayerDans = Math.max(1, Math.ceil((plusAncien + FENETRE_MS - mtn) / 1000));
    return { ok: false, reessayerDans };
  }
  temps.push(mtn);
  compteurs.set(cle, temps);
  return { ok: true };
}

/** Réponse 429 JSON en français, avec l'en-tête Retry-After. */
export function reponseTropDeRequetes(reessayerDans: number): NextResponse {
  return NextResponse.json(
    {
      error: `Trop de requêtes : limite de ${LIMITE_REQUETES_PAR_MINUTE} appels par minute atteinte. Réessaie dans quelques secondes.`,
    },
    { status: 429, headers: { "Retry-After": String(reessayerDans) } }
  );
}
