-- ==========================================
-- MIGRATION : Upgrade table homework
-- Ajouter ce SQL dans l'éditeur SQL de Supabase
-- ==========================================

-- Ajouter la colonne teacher
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS teacher TEXT DEFAULT '';

-- Ajouter la colonne priority  
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Ajouter la colonne status
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo';

-- Ajouter la colonne progression
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS progression INTEGER DEFAULT 0;
