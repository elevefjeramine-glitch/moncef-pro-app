-- 0010_thunder.sql
-- Thunder, l'assistant ancré sur les documents de l'élève (esprit NotebookLM).
--
-- Deux tables seulement. Aucun vecteur : la base ne contient pas de colonne
-- `embedding` et la recherche de Thunder est lexicale (src/lib/thunder.ts), donc
-- rien ici ne prétend stocker une représentation sémantique qu'on ne calcule pas.
--
-- Idempotent : relançable sans effet de bord.

-- ── 1. Les sources de travail ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.thunder_sources (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre      text NOT NULL CHECK (char_length(titre) BETWEEN 2 AND 200),
  matiere    text CHECK (matiere IS NULL OR char_length(matiere) <= 80),
  texte      text NOT NULL CHECK (char_length(texte) BETWEEN 40 AND 400000),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.thunder_sources IS
  'Cours, fiches et énoncés qu''un élève donne à Thunder comme matière première. La réponse de l''assistant est bornée à ces lignes.';
COMMENT ON COLUMN public.thunder_sources.texte IS
  'Texte brut. La limite de 400 000 caractères est alignée sur le plafond de contexte de /api/thunder (240 000 caractères lus par requête) : au-delà, la route le dit explicitement plutôt que de lire à moitié.';

CREATE INDEX IF NOT EXISTS thunder_sources_user_created_idx
  ON public.thunder_sources (user_id, created_at DESC);

-- ── 2. Les parties jouées, pour le tableau interactif ───────────────────────
CREATE TABLE IF NOT EXISTS public.thunder_quiz_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total       smallint NOT NULL CHECK (total BETWEEN 1 AND 40),
  justes      smallint NOT NULL CHECK (justes BETWEEN 0 AND 40),
  niveau      text CHECK (niveau IS NULL OR char_length(niveau) <= 40),
  lignes      jsonb NOT NULL,   -- [{n, justifie, choisi}] — le détail, pas un résumé
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (justes <= total)
);

COMMENT ON TABLE public.thunder_quiz_attempts IS
  'Historique des QCM Thunder : sert au tableau de progression. Les énoncés ne sont PAS stockés ici — ils dépendent des sources, qui peuvent être supprimées ; on ne garde que le résultat et le détail par question.';

CREATE INDEX IF NOT EXISTS thunder_quiz_attempts_user_idx
  ON public.thunder_quiz_attempts (user_id, created_at DESC);

-- ── 3. RLS : chaque compte ne voit que les siennes ───────────────────────────
ALTER TABLE public.thunder_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thunder_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Politiques nommées « owner_* » pour ne rien chevaucher avec l'existant, et
-- TO OWNER : un jeton d'anon-key volé ne peut ni lire ni écrire ici. Les routes
-- d'API passent par le rôle service et filtrent sur user_id, comme /api/chat.
DROP POLICY IF EXISTS "owner_select_sources" ON public.thunder_sources;
CREATE POLICY "owner_select_sources" ON public.thunder_sources
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_insert_sources" ON public.thunder_sources;
CREATE POLICY "owner_insert_sources" ON public.thunder_sources
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_delete_sources" ON public.thunder_sources;
CREATE POLICY "owner_delete_sources" ON public.thunder_sources
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_select_attempts" ON public.thunder_quiz_attempts;
CREATE POLICY "owner_select_attempts" ON public.thunder_quiz_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_insert_attempts" ON public.thunder_quiz_attempts;
CREATE POLICY "owner_insert_attempts" ON public.thunder_quiz_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Pas de politique UPDATE : une partie jouée ne se réécrit pas. C'est un choix,
-- pas un oubli — sans politique, l'écriture est refusée par défaut.

-- ── 4. Suppression en cascade côté compte ────────────────────────────────────
-- Les deux tables référencent auth.users ON DELETE CASCADE, donc la purge du
-- compte (src/lib/compte.ts, purgeAccount) n'a pas besoin d'être modifiée pour
-- elles : elle s'appuie déjà sur la cascade. Vérifié après application par le
-- comptage des lignes orphelines (0 attendu).
