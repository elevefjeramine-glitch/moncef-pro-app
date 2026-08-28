-- =====================================================================
--  SÉCURITÉ — politiques RLS de public.users
--  ⚠️ CE FICHIER A DÉJÀ ÉTÉ EXÉCUTÉ sur le projet ggnwtszeitrrfhedgipv
--     le 28/08/2026 via l'API de gestion Supabase. Il sert de référence :
--     c'est l'état réel de la base, pas une suggestion.
--
--  Ce qui a été trouvé (prouvé en prod, avec la seule clé publique du site) :
--   1. PATCH /rest/v1/users  {"role":"founder"} → HTTP 200 : n'importe quel
--      compte connecté se promouvait founder et ouvrait /api/alpha
--      (liste de tous les utilisateurs, emails, devoirs, modif/suppression
--      de comptes).
--      Cause : "Users can update own profile" = USING (auth.uid() = id)
--      SANS WITH CHECK et sans trigger → aucune colonne protégée.
--   2. "Users are readable by everyone" = USING (true) en SELECT : tout
--      compte connecté lisait email / role / tokens de tout le monde.
--
--  Ce que ces objets corrigent :
--   - trigger BEFORE UPDATE : bloque role et tokens pour les rôles
--     anon/authenticated UNIQUEMENT. current_user = 'service_role' (nos
--     API routes, décrément de crédits) et 'postgres' (Dashboard) passent.
--     → vérifié : /api/chat décrémente toujours 700 → 690 → 680.
--   - politique UPDATE avec WITH CHECK (défense en profondeur).
--   - vue security_invoker qui n'expose AUCUNE colonne sensible ; elle
--     relance la politique SELECT de `users` côté appelant, donc chaque
--     lecteur voit autrui sans jamais voir email/role/tokens.
--   - politique SELECT sur users restreinte à sa propre ligne.
--   - REVOKE : un client ne peut plus supprimer/tronquer/insérer dans users.
--     La création de la ligne reste assurée par le trigger existant
--     on_auth_user_created → public.handle_new_user() (SECURITY DEFINER,
--     donc non affecté).
--
--  Côté app : src/app/app/comm/page.tsx lit `users_public_profile` au lieu
--  de `users` pour les autres utilisateurs ; src/app/auth/page.tsx ne fait
--  plus d'upsert de colonnes inexistantes (phone/address/city/postal_code
--  n'existent pas dans public.users — l'appel échouait en silence).
-- =====================================================================

-- ---------------------------------------------------------------- 1) garde-fou
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

-- ---------------------------------------------------------------- 2) UPDATE
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------- 3) SELECT
-- `users` : chacun ne voit que sa propre ligne (email, tokens, role = privés)
DROP POLICY IF EXISTS "Users are readable by everyone" ON public.users;
CREATE POLICY "own row readable"
  ON public.users FOR SELECT TO anon, authenticated
  USING (auth.uid() = id);

-- Les identités publiques (pseudo, avatar, statut) restent lisibles par tous,
-- pour la messagerie et les listes de membres.
-- security_invoker = true est INDISPENSABLE : sans cette option la vue lit avec
-- les droits du propriétaire (postgres) et contourne RLS → elle ne protège rien.
-- NB : une vue simple ne peut PAS avoir de politique RLS (erreur 42809).
CREATE OR REPLACE VIEW public.users_public_profile
WITH (security_invoker = true) AS
SELECT id, first_name, last_name, avatar_url, app_lang, theme_color, language, status
FROM public.users;

GRANT SELECT ON public.users_public_profile TO anon, authenticated, service_role;

-- ---------------------------------------------------------------- 4) privilèges
REVOKE DELETE, TRUNCATE, REFERENCES ON public.users FROM anon, authenticated;
REVOKE INSERT ON public.users FROM anon, authenticated;

-- =====================================================================
--  CONTRÔLES (relancés le 28/08/2026, tous concluants)
--
--  A. Auto-promotion → bloquée
--     PATCH /rest/v1/users?role=eq.normal  {"role":"founder","tokens":999999}
--     HTTP 400 {"code":"P0001","message":"Modification du champ role interdite
--               depuis un client"}      et la base garde role='normal'
--
--  B. Panneau admin → 403 pour un compte normal
--     POST /api/alpha {"action":"GET_STATS"}  → HTTP 403 {"error":"Accès refusé"}
--
--  C. Lecture des emails d'autrui → vide
--     GET /rest/v1/users?select=email,role,tokens        → 1 ligne (la sienne)
--     GET /rest/v1/users?id=eq.<uuid_d_un_autre>         → []
--     GET /rest/v1/users_public_profile?id=eq.<autre>   → first_name seulement
--
--  D. Non-régression
--     PATCH /rest/v1/users (first_name, theme_color)     → HTTP 204  ✅
--     POST /api/chat                                      → HTTP 200, tokens
--                                                          700→690→680 ✅
--     service_role : SELECT count(*) on public.users     → 5        ✅
--     trigger handle_new_user : toujours fonctionnel (profil créé à
--     l'inscription avec role='normal', tokens=700)       ✅
-- =====================================================================
