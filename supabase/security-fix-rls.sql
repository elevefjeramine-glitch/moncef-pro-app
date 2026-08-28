-- =====================================================================
--  SÉCURITÉ — verrouillage de public.users  (état RÉEL de la base)
--
--  ⚠️ Déjà appliqué le 28/08/2026 sur le projet ggnwtszeitrrfhedgipv,
--     via l'API de gestion Supabase. Ce fichier est la reproduction exacte
--     de l'état courant (pour reconstruire un environnement ou auditer).
--
--  ---------------------------------------------------------------------
--  CE QUI A ÉTÉ TROUVÉ (prouvé en prod avec la seule clé publique du site)
--
--  1. Auto-promotion au rôle admin :
--       PATCH /rest/v1/users?role=eq.normal   {"role":"founder","tokens":999999}
--       → HTTP 200, role effectivement changé, puis POST /api/alpha
--         (GET_STATS) → HTTP 200 avec la liste de tous les utilisateurs.
--     Cause : la politique "Users can update own profile" avait un
--     USING (auth.uid() = id) sans WITH CHECK, et AUCUN trigger ne
--     protégeait les colonnes. PostgREST autorise donc à écrire n'importe
--     quelle colonne de sa propre ligne.
--
--  2. Fuite de données personnelles :
--     CREATE POLICY "Users are readable by everyone" ... USING (true)
--     + GRANT SELECT (table entière) → tout compte connecté lisait
--     email / role / tokens de tout le monde.
--
--  ---------------------------------------------------------------------
--  CE QUI EST EN PLACE MAINTENANT
--
--  Principe : RLS décide DES LIGNES, pas des colonnes. Pour les colonnes,
--  on utilise les PRIVILÈGES PAR COLONNE (has_column_privilege). Une vue
--  ne peut pas porter de politique RLS (erreur 42809, même avec
--  security_invoker), et une vue security_invoker hérite des droits du
--  client → elle ne peut donc pas révéler plus que ce que le client peut
--  déjà lire. D'où : une vue publique qui ne SÉLECTIONNE que le non-sensible,
--  et une fonction SECURITY DEFINER pour « mes données à moi ».
-- =====================================================================

-- ---------------------------------------------------------------- 1) GARDE-FOU
-- role et tokens ne sont plus modifiables par un client. current_user est
-- 'service_role' dans nos API routes et 'postgres' dans le SQL Editor : ils
-- passent (le décrément de crédits de /api/chat est vérifié fonctionnel).
CREATE OR REPLACE FUNCTION public.guard_privileged_columns()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF current_user::text IN ('anon','authenticated') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Modification du champ role interdite depuis un client';
    END IF;
    IF NEW.tokens IS DISTINCT FROM OLD.tokens THEN
      RAISE EXCEPTION 'Modification du champ tokens interdite depuis un client';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_guard_privileged_columns ON public.users;
CREATE TRIGGER trg_guard_privileged_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_privileged_columns();

-- ---------------------------------------------------------------- 2) POLITIQUES
DROP POLICY IF EXISTS "Users are readable by everyone" ON public.users;

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------- 3) PRIVILÈGES
-- ⚠️ Ordre important : un REVOKE sur la table révoque AUSSI les privilèges
--    par colonne. Les GRANT (colonne) doivent donc venir APRÈS le REVOKE.
REVOKE ALL ON public.users FROM anon, authenticated;
-- role est en lecture : utile aux badges de la messagerie, et ce n'est pas une
-- donnée personnelle. L'ÉCRITURE de role/tokens reste interdite (trigger + absence
-- de privilège UPDATE sur ces colonnes), donc lecture ≠ escalade.
GRANT SELECT (id, first_name, last_name, avatar_url, app_lang, theme_color, language, status, role)
  ON public.users TO anon, authenticated;
GRANT UPDATE (first_name, last_name, avatar_url, theme_color, language, status, app_lang)
  ON public.users TO authenticated;
-- pas d'INSERT : la ligne est créée par on_auth_user_created → handle_new_user()
-- (SECURITY DEFINER, non affecté par ces REVOKE).

-- le service_role garde l'accès complet : c'est lui qui porte /api/chat et /api/alpha
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;

-- ---------------------------------------------------------------- 4) VUE PUBLIQUE
-- Liste des membres / avatars dans la messagerie. Contient par construction
-- uniquement des colonnes non sensibles.
CREATE OR REPLACE VIEW public.users_public_profile AS
SELECT id, first_name, last_name, avatar_url, app_lang, theme_color, language, status, role
FROM public.users;
GRANT SELECT ON public.users_public_profile TO anon, authenticated;

-- ---------------------------------------------------------------- 5) RPC
-- "mes données complètes" : le filtre est dans la fonction, pas dans RLS.
CREATE OR REPLACE FUNCTION public.get_me()
RETURNS SETOF public.users LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT * FROM public.users WHERE id = auth.uid(); $$;
REVOKE EXECUTE ON FUNCTION public.get_me() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_me() TO anon, authenticated, service_role;

-- Reserved pour un éventuel accès admin direct par RPC (le panneau utilise
-- aujourd'hui le client service_role, ces fonctions ne sont pas appelées) :
-- ⚠️ Ces deux fonctions admin sont fournies en secours : le panneau /api/alpha
-- n'en a pas besoin (il passe par le client service_role). Elles ne sont pas
-- appelées par le code actuel.
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS SETOF public.users LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT * FROM public.users ORDER BY created_at DESC; $$;
REVOKE EXECUTE ON FUNCTION public.admin_get_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_user(patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.users
     SET role   = COALESCE(patch->>'role', role),
         tokens = COALESCE((patch->>'tokens')::int, tokens),
         email  = COALESCE(patch->>'email', email)
   WHERE id = (patch->>'id')::uuid;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_update_user(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user(jsonb) TO service_role;

-- =====================================================================
--  CODE ADAPTÉ EN MÊME TEMPS (sinon l'app cassait)
--   * src/app/page.tsx, src/app/app/layout.tsx, src/app/app/comm/page.tsx,
--     src/app/app/alpha/page.tsx : les lectures `from('users').select('*')`
--     deviennent `rpc('get_me')`.
--   * src/app/app/comm/page.tsx : les 3 lectures des AUTRES utilisateurs
--     passent de `users` à `users_public_profile`.
--   * src/app/auth/page.tsx : l'upsert d'inscription écrivait phone, address,
--     city, postal_code — 4 colonnes qui n'existent pas dans public.users
--     (l'appel échouait silencieusement, `error` n'était jamais regardé).
--     Remplacé par une update ciblée sur first_name/last_name.
--   * src/app/api/alpha/route.ts : le contrôle de rôle lisait `role` avec le
--     client anon (désormais refusé) → lecture via le client admin, avec
--     échec fermé en 503 si la clé service_role manque.
--
--  CONTRÔLES EFFECTUÉS (28/08/2026)
--   has_column_privilege('authenticated','users','email','SELECT')   = false
--   has_column_privilege('authenticated','users','role','UPDATE')    = false
--   has_column_privilege('service_role','users','tokens','UPDATE')   = true
--   PATCH {"role":"founder"} par un client  → HTTP 400 P0001 "Modification du
--                                             champ role interdite depuis un client"
--   GET /users?select=email  par un client  → HTTP 403 42501
--   GET /users_public_profile?select=tokens → HTTP 400 42703 (colonne absente de la vue)
--   GET /users_public_profile               → HTTP 200, 8 colonnes, sans email
--   POST /api/alpha (compte normal)         → HTTP 403 {"error":"Accès refusé"}
--   POST /api/chat                          → HTTP 200, tokens 700 → 690
--   Formulaire d'inscription                → update 204, profil correct
-- =====================================================================
