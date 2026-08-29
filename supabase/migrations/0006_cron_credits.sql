-- ─────────────────────────────────────────────────────────────────────────────
-- VERDICT DU 29/08/2026 — CE FICHIER N'EST VOLONTAIREMENT PAS APPLIQUÉ.
--
-- `pg_cron` est installé depuis (1.6.4, mesuré), donc le bloc `cron.schedule`
-- serait exécutable. Il ne faut pas. Raison, lue dans le fichier lui-même :
--   'reset-tokens-every-2-hours', '0 */2 * * *' → UPDATE users SET tokens = 700
-- soit DOUZE remises de 700 crédits par jour et par compte, pour les rôles
-- `normal` ET `moderator`. Le plancher réel de l'application
-- (`applyDailyCreditFloor`, src/lib/compte.ts) remet 700 UNE fois par jour, à la
-- première demande, et ne touche pas aux fondateurs. Brancher 0006 reviendrait à
-- multiplier par douze le budget de crédits payants de chaque élève.
--
-- Si un jour il faut un réveil (compter les jours sans visite, purger les files),
-- écrire une migration neuve qui APPELLE le plancher existant, et non un UPDATE brut.
-- ─────────────────────────────────────────────────────────────────────────────
-- Déplacé depuis /cron_credits.sql sans modifier le contenu — sha256 3c6b44f2719d
-- ⚠️ NE PAS RELANCER AVEUGLÉMENT : l'état réel de la base est décrit dans
--    supabase/security-fix-rls.sql et SECURITY.md. Archivage d'historique.

-- ==========================================
-- FONCTION : Régénération des Crédits
-- ==========================================

-- 1. On crée une fonction métier qui remet les tokens à 700 pour les rôles normaux et modérateurs
-- (Les fondateurs gardent "Illimité" dans l'UI mais en DB on peut les mettre à 9999 si on veut)
CREATE OR REPLACE FUNCTION reset_daily_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Met à jour les utilisateurs normaux
  UPDATE public.users 
  SET tokens = 700 
  WHERE role IN ('normal', 'moderator');
  
  -- (Optionnel) Reset les admins/fondateurs très haut au cas où
  UPDATE public.users 
  SET tokens = 99999 
  WHERE role = 'founder';
END;
$$;

-- 2. On utilise pg_cron (l'extension CRON intégrée à Supabase)
-- Pour exécuter cette fonction toutes les 2 heures par exemple.
-- Note: il faut activer pg_cron dans Extensions sur Supabase d'abord.

SELECT cron.schedule(
  'reset-tokens-every-2-hours', -- Nom de la tâche
  '0 */2 * * *',                -- Format CRON : à la minute 0 de chaque 2ème heure (00:00, 02:00, 04:00, etc.)
  'SELECT reset_daily_tokens();'
);

-- Pour vérifier vos tâches programmées :
-- SELECT * FROM cron.job;
