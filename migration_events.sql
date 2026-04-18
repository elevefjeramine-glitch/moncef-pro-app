-- ==========================================
-- MIGRATION : TABLE ÉVÉNEMENTS
-- À copier/coller dans l'éditeur SQL de Supabase
-- ==========================================

CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_date DATE NOT NULL,
  event_time TEXT DEFAULT '',
  category TEXT DEFAULT 'general' CHECK (category IN ('exam', 'homework', 'meeting', 'trip', 'sport', 'general', 'reminder')),
  color TEXT DEFAULT '#00D2B6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own events" ON public.events
  FOR ALL USING (auth.uid() = user_id);
