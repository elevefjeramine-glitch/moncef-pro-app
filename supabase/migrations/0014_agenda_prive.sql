-- ─────────────────────────────────────────────────────────────────────────────
-- 0014 · Le lien d'agenda (lot A4) : un jeton par compte, dans SA table.
--
-- Un calendrier se souscrit : Google et Apple rappellent l'URL sans session, donc la
-- route `.ics` ne peut pas exiger un jeton d'authentification. Le secret est alors dans
-- l'URL — et une URL qu'on ne peut pas révoquer est une fuite perpétuelle (le lien se
-- recopie dans un groupe de classe, il atterrit dans un courriel).
--
-- D'où trois choix, dans cet ordre :
--  1 · le jeton vit dans `public.agenda_tokens`, PAS dans `public.users` : la table des
--      comptes a une politique de LECTURE `USING (true)` (mesuré le 29/08/2026 — elle est
--      inoffensive aujourd'hui parce que `anon`/`authenticated` n'ont AUCUN droit sur la
--      table, 42501 ; mais un secret ne doit pas dépendre de cette coïncidence) ;
--  2 · une seule ligne par compte, remplaçable : « régénérer » casse le lien précédent ;
--  3 · RLS comme le reste du site (chaque compte ne voit que sa ligne), et AUCUN droit
--      pour `anon`/`authenticated`/`service_role` côté client : la route passe par le
--      client d'administration, comme pour `review_cards`.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agenda_tokens (
  user_id   uuid PRIMARY KEY,
  jeton     text NOT NULL UNIQUE CHECK (char_length(jeton) = 32),
  cree_le   timestamptz NOT NULL DEFAULT now(),
  vu_le     timestamptz,
  -- un lien qui sert à un calendrier tous les jours ne doit pas mourir : on ne note pas
  -- « expiré », on note la dernière lecture, pour répondre à « ce lien est-il vivant ? »
  lectures  integer NOT NULL DEFAULT 0 CHECK (lectures >= 0)
);

ALTER TABLE public.agenda_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_agenda" ON public.agenda_tokens;
CREATE POLICY "owner_select_agenda" ON public.agenda_tokens FOR SELECT USING (auth.uid() = user_id);

REVOKE ALL    ON public.agenda_tokens FROM anon, authenticated;
GRANT  SELECT ON public.agenda_tokens TO service_role;
GRANT  ALL    ON public.agenda_tokens TO postgres;
