-- 0013_revisions_espacement.sql
-- Cartes de révision espacées (Leitner), séries, et abonnements de notification.
--
-- Pourquoi ça existe : le QCM de Thunder corrige une erreur puis l'oublie. Ces trois
-- tables transforment une réponse juste en une date de révision, et une erreur en une
-- carte qui revient — c'est la différence entre « un site qui répond » et « un site
-- qui fait réviser ».
--
-- Ce qui est volontairement absent :
--  • aucun calcul de note, aucun jugement : une carte dit « revois ça », rien de plus ;
--  • aucun champ d'horloge inventé : `due_at` porte l'intervalle, `review_log` ne compte
--    que des cartes réellement notées par l'élève ;
--  • RLS partout : chaque compte ne lit que ses lignes, comme le reste du projet
--    (la vitrine l'affirme, donc le code le fait).
--
-- Idempotent : relançable sans effet de bord.

-- ── 1 · la file de révision ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.review_cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  source_id    uuid references public.thunder_sources(id) on delete set null,
  question     text not null check (char_length(question) between 3 and 1200),
  reponse      text not null check (char_length(reponse) between 1 and 1200),
  ce_que_tu_avais text,                        -- la réponse choisie, pour montrer l'écart
  matiere      text,
  empreinte    text not null,                  -- md5(question) : empêche le doublon du même soir
  boite        smallint not null default 1 check (boite between 1 and 6),
  due_at       timestamptz not null default now(),
  reps         int not null default 0,         -- nombre de fois notée
  lapses       int not null default 0,         -- combien de fois « à revoir » après l'avoir su
  origine      text not null default 'quiz',   -- 'quiz' = née d'une erreur, 'manuel' = ajoutée
  created_at   timestamptz not null default now(),
  last_grade_at timestamptz,
  unique (user_id, empreinte)
);

COMMENT ON TABLE public.review_cards IS
  'File de révision espacée d''un élève (Leitner 6 boîtes, 1/3/7/14/30/60 jours).';
COMMENT ON COLUMN public.review_cards.boite IS
  '1 = à revoir demain, 6 = su pour deux mois. Notation : encore = -2, bien = +1, facile = +2.';
COMMENT ON COLUMN public.review_cards.empreinte IS
  'd64(question) — contrainte d''unicité par élève : une même erreur ne crée pas 4 cartes le même soir.';

CREATE INDEX IF NOT EXISTS review_cards_due_idx ON public.review_cards (user_id, due_at);
CREATE INDEX IF NOT EXISTS review_cards_user_idx ON public.review_cards (user_id, created_at desc);

ALTER TABLE public.review_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS review_cards_a_chacun ON public.review_cards;
CREATE POLICY review_cards_a_chacun ON public.review_cards
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.review_cards FROM anon;

-- ── 2 · ce qui a été réellement révisé (pour les séries) ──────────────────────
CREATE TABLE IF NOT EXISTS public.review_log (
  user_id  uuid not null references public.users(id) on delete cascade,
  day      date not null,
  notees   int not null default 0,
  justes   int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

COMMENT ON TABLE public.review_log IS
  'Une ligne par élève et par jour (UTC) : combien de cartes notées, combien de « bien/facile ». La série se calcule ici, pas dans le cœur de l''élève.';

ALTER TABLE public.review_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS review_log_a_chacun ON public.review_log;
CREATE POLICY review_log_a_chacun ON public.review_log
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.review_log FROM anon;

-- ── 3 · abonnements de notification (Web Push, aucun service externe) ─────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

COMMENT ON TABLE public.push_subscriptions IS
  'Abonnements Web Push de l''élève. Clé privée VAPID uniquement côté serveur (variable d''environnement) : la base ne contient que les coordonnées de l''abstract push service.';

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_sub_a_chacun ON public.push_subscriptions;
CREATE POLICY push_sub_a_chacun ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.push_subscriptions FROM anon;

-- ── 4 · la date du jour, lue côté base (évite les écarts d'horloge machine) ───
CREATE OR REPLACE FUNCTION public.aujourdhui_utc()
RETURNS date LANGUAGE sql STABLE AS $$
  select (now() at time zone 'UTC')::date
$$;

COMMENT ON FUNCTION public.aujourdhui_utc() IS
  'Le jour de référence pour la série et le port du solde : UTC, une seule source de vérité.';
