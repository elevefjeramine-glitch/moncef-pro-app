-- 0009_credits_et_suppression_programmee.sql
-- Ajoute deux colonnes à public.users, sans casser l'existant :
--   tokens_reset_at        : date du dernier port du solde au plancher quotidien (700)
--   deletion_scheduled_at  : échéance de suppression du compte (7 jours après la demande)
--
-- Pourquoi en code et pas en pg_cron : la migration 0006 (reset_daily_tokens + cron.schedule)
-- n'a JAMAIS été appliquée à cette base — vérifié le 2026-08-28 :
--   SELECT count(*) FROM pg_extension WHERE extname='cron';  --> 0
--   SELECT ... FROM pg_proc WHERE proname='reset_daily_tokens';  --> aucune ligne
-- Le rechargement est donc déclenché paresseusement au premier appel authentifié du jour
-- (voir src/lib/compte.ts), ce qui ne demande aucune extension.
--
-- Idempotent : relançable sans effet de bord.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tokens_reset_at date,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz;

COMMENT ON COLUMN public.users.tokens_reset_at IS
  'Dernière date (UTC) à laquelle le solde a été porté au plancher quotidien de 700 crédits.';

COMMENT ON COLUMN public.users.deletion_scheduled_at IS
  'Échéance de suppression définitive du compte (demande utilisateur + 7 jours). NULL = aucune demande en cours.';

-- Index partiel minuscule : seule la file d'attente de suppression est scannée.
CREATE INDEX IF NOT EXISTS users_deletion_due_idx
  ON public.users (deletion_scheduled_at)
  WHERE deletion_scheduled_at IS NOT NULL;
