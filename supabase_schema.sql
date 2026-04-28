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
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, role, tokens)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'first_name', 'Utilisateur'), 
    COALESCE(new.raw_user_meta_data->>'last_name', ''), 
    'normal', 
    700
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activation du trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
