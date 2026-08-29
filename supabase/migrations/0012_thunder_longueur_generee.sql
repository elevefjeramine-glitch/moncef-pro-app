-- 0012_thunder_longueur_generee.sql
-- Colonne calculée `longueur` sur thunder_sources, née d'un échec mesuré en production.
--
-- Le 29/08/2026 à 14:41, POST /api/thunder {mode:"sources"} renvoyait :
--   500 "Could not find a relationship between 'thunder_sources' and 'length' in the schema cache"
-- Cause : la route faisait `.select("id, titre, matiere, length(texte) as longueur")`. PostgREST
-- n'évalue PAS de fonction SQL dans `select` — il interprète `length(texte)` comme une
-- ressource embarquée (une jointure) nommée `length`, n'en trouve aucune, et l'opération
-- échoue. Le même motif cassait la liste des sources et le GET de l'inventaire : le panneau
-- entier était hors service, ce que le test HTTP précédent n'avait pas pu voir (il exige une
-- session, et le jeton de gestionétait mort).
--
-- Correctif retenu : une colonne générée, calculée par PostgreSQL à l'écriture. Le coût est
-- payé une fois par insert, la lecture devient une colonne ordinaire, et le comptage affiché
-- à l'élève reste exactement char_length(texte) — pas une estimation côté client.
--
-- Idempotent.

ALTER TABLE public.thunder_sources
  ADD COLUMN IF NOT EXISTS longueur integer GENERATED ALWAYS AS (char_length(texte)) STORED;

COMMENT ON COLUMN public.thunder_sources.longueur IS
  'char_length(texte), calculé par PostgreSQL (colonne générée STORED). Lu tel quel par /api/thunder : PostgREST ne sait pas évaluer length() dans une sélection.';
