-- ==========================================
-- SCHÉMA DE BASE DE DONNÉES "MONCEF IA"
-- A copier/coller dans l'éditeur SQL de Supabase
-- ==========================================

-- 1. Table Utilisateurs (Profile enrichi)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'normal'::text CHECK (role IN ('normal', 'moderator', 'founder')),
  tokens INTEGER DEFAULT 700,
  theme_color TEXT DEFAULT '#00D2B6',
  avatar_url TEXT,
  language TEXT DEFAULT 'fr',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Active RLS sur Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Politique : Tout le monde peut voir les profiles (pour le chat)
CREATE POLICY "Users are readable by everyone" ON public.users FOR SELECT USING (true);
-- Politique : L'utilisateur peut modifier seulement son propre profile
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);


-- 2. Table Messages Privés
CREATE TABLE public.user_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Politique : Un utilisateur peut voir ses messages privés OU les messages publics (sans destinataire spécifique)
CREATE POLICY "Users can view messages" ON public.user_messages 
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR receiver_id IS NULL);
-- Politique : Un utilisateur ne peut envoyer un message qu'en son propre nom
CREATE POLICY "Users can send messages" ON public.user_messages 
  FOR INSERT WITH CHECK (auth.uid() = sender_id);


-- 3. Table Devoirs (Homework Tracker)
CREATE TABLE public.homework (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  task TEXT NOT NULL,
  teacher TEXT DEFAULT '',
  is_done BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'low')),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'forgotten')),
  progression INTEGER DEFAULT 0 CHECK (progression >= 0 AND progression <= 100),
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;

-- Politique : Chacun ne voit et gère que ses propres devoirs
CREATE POLICY "Users manage own homework" ON public.homework 
  FOR ALL USING (auth.uid() = user_id);


-- 4. Table Emploi du Temps (Schedule)
CREATE TABLE public.schedule (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  week TEXT CHECK (week IN ('A', 'B')) NOT NULL,
  day_index INTEGER CHECK (day_index >= 0 AND day_index <= 6),
  subj TEXT NOT NULL,
  time_slot TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own schedule" ON public.schedule 
  FOR ALL USING (auth.uid() = user_id);


-- ==========================================
-- FONCTION AUTOMATIQUE POST-INSCRIPTION
-- Trigger pour créer automatiquement un Profile ("users") quand un compte Auth est créé
-- ==========================================

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

  -- Activation du trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
