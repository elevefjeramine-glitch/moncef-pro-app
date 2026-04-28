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
