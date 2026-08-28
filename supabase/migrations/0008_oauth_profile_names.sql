-- 0008_oauth_profile_names.sql
-- Les inscrits via Google/Microsoft/Apple n'ont PAS de `first_name` dans leurs
-- métadonnées : Google renvoie `full_name` (+ `given_name`/`family_name` pour Azure,
-- `surname` pour Apple). L'ancienne fonction écrivait donc 'Utilisateur' comme prénom
-- pour chaque compte OAuth, et le nom restait vide.
--
-- Nouvelle règle, dans l'ordre : first_name / given_name -> full_name (1er mot) ;
-- last_name / family_name / surname -> full_name (reste) ; sinon préfixe de l'email.
-- `ON CONFLICT DO NOTHING` rend la fonction sûre si un profil existe déjà.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  meta      jsonb := NEW.raw_user_meta_data;
  v_first   text;
  v_last    text;
  v_full    text;
  v_space   int;
BEGIN
  v_first := NULLIF(meta->>'first_name', '');
  v_last  := NULLIF(meta->>'last_name', '');
  IF v_first IS NULL THEN v_first := NULLIF(meta->>'given_name', '');  END IF;
  IF v_last  IS NULL THEN v_last  := NULLIF(meta->>'family_name', ''); END IF;
  IF v_last  IS NULL THEN v_last  := NULLIF(meta->>'surname', '');     END IF;
  v_full := NULLIF(meta->>'full_name', '');
  IF v_full IS NULL THEN v_full := NULLIF(meta->>'name', ''); END IF;

  IF v_first IS NULL AND v_full IS NOT NULL THEN
    v_space := position(' ' in v_full);
    IF v_space > 0 THEN
      v_first := left(v_full, v_space - 1);
      IF v_last IS NULL THEN v_last := btrim(substring(v_full from v_space + 1)); END IF;
    ELSE
      v_first := v_full;
    END IF;
  END IF;

  IF v_first IS NULL THEN
    v_first := COALESCE(NULLIF(split_part(NEW.email, '@', 1), ''), 'Utilisateur');
  END IF;

  INSERT INTO public.users (id, email, first_name, last_name, role, tokens)
  VALUES (
    NEW.id,
    NEW.email,
    btrim(v_first),
    COALESCE(btrim(v_last), ''),
    'normal',
    700
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
