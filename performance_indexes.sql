-- ==========================================
-- OPTIMISATION DE LA BASE DE DONNÉES (ZÉRO DÉFAUT)
-- A copier/coller dans le SQL Editor de Supabase pour accélérer les requêtes
-- ==========================================

-- 1. Index pour accélérer le chargement et le tri des Devoirs (Homework)
-- Les requêtes de devoirs filtrent souvent par user_id et par status/is_done
CREATE INDEX IF NOT EXISTS idx_homework_user_status 
ON public.homework (user_id, status);

CREATE INDEX IF NOT EXISTS idx_homework_user_date 
ON public.homework (user_id, due_date ASC);

-- 2. Index pour accélérer la Messagerie (User Messages)
-- Les conversations s'affichent par sender/receiver et on les trie par date de création descendante
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
ON public.user_messages (sender_id, receiver_id, created_at DESC);

-- Cet index optimisera les affichages des messages groupés
CREATE INDEX IF NOT EXISTS idx_messages_receiver
ON public.user_messages (receiver_id);

-- 3. Index pour la table Schedule (Emploi du temps)
-- On accède presque toujours à l'edt d'un user_id pour une semaine spécifique
CREATE INDEX IF NOT EXISTS idx_schedule_user_week 
ON public.schedule (user_id, week, day_index);
