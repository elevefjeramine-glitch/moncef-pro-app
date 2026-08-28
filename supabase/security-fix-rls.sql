-- =====================================================================
--  SÉCURITÉ : empêcher l'auto-promotion au rôle founder/modérateur
--  Fichier prêt à exécuter — il ne se passe RIEN tant que tu ne le lances pas.
--
--  ❌ Faille prouvée en prod le 28/08/2026 (avec la seule clé publique du site) :
--       PATCH /rest/v1/users?role=eq.normal   body {"role":"founder"}  → HTTP 200
--     puis le compte promu appelle POST /api/alpha (GET_STATS) → HTTP 200,
--     liste de tous les utilisateurs + emails.
--
--  🎯 Cause : supabase_schema.sql ligne 26
--       CREATE POLICY "Users can update own profile" ON public.users
--         FOR UPDATE USING (auth.uid() = id);
--     → USING autorise la modif de SA ligne, mais sans WITH CHECK ni garde-fou
--       PostgREST ne bloque aucune COLONNE : ni `role`, ni `tokens`.
--     (le service_role passe par là aussi : la politique s'applique à tous les rôles)
--
--  ▶ Comment l'exécuter :
--     Supabase Dashboard → ton projet → SQL Editor (icône </>) → New query
--     → coller TOUT ce fichier → Run. Durée : 20 secondes.
--     Alternative sans copier-coller : donner un token "sbp_..." (Account →
--     Access Tokens) et laisser l'API Management l'exécuter.
-- =====================================================================

-- 1) Trigger garde-fou : le CLIENT (anon / authenticated) ne peut plus toucher
--    `role` ni `tokens`. On teste `current_user` (= le rôle postgres réellement
--    actif) : le service_role des API routes et le rôle postgres du Dashboard ne
--    sont PAS concernés, donc /api/chat (décrément de crédits) continue de marcher.
--    NB: ne PAS tester request.jwt.claim.role -> cela renvoie tout le JSON des
--    claims, jamais la chaîne 'anon'. Le test serait toujours faux-négatif.
CREATE OR REPLACE FUNCTION public.guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Le champ role ne peut pas etre modifie depuis un client'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.tokens IS DISTINCT FROM OLD.tokens THEN
      RAISE EXCEPTION 'Le solde tokens ne peut pas etre modifie depuis un client'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_guard_privileged_columns ON public.users;
CREATE TRIGGER trg_guard_privileged_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_privileged_columns();

-- 2) Durcir la politique : ajouter WITH CHECK (défense en profondeur, redondant
--    avec le trigger mais explicite pour l'audit).
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMIT;

-- =====================================================================
--  CONTRÔLE APRÈS EXÉCUTION (à faire depuis le site, en étant connecté
--  avec un compte normal) :
--    PATCH .../rest/v1/users?role=eq.normal   {"role":"founder"}
--  → doit renvoyer une erreur 42501 / "Le champ role ne peut pas..."
--    et PLUS  {"role":"founder"}
--
--  Ce que ce fichier NE corrige PAS (à traiter dans une 2e passe, car ça
--  demande de modifier le code de l'app) :
--    - "Users are readable by everyone" (SELECT USING (true)) laisse encore
--      n'importe quel compte connecté lire email/role/tokens des autres.
--      Fix = vue publique sans colonnes sensibles + restreindre le SELECT,
--      et faire lire `users_public_profile` au chat/classement.
--    - le mot de passe du compte fondateur a été publié dans setup-founder.mjs
--      → À CHANGER MANUELLEMENT (priorité absolue, avant tout le reste).
-- =====================================================================
