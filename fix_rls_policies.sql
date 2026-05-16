-- ==========================================
-- SCRIPT DE CORRECTION: BOUCLE INFINIE RLS
-- A copier/coller dans l'éditeur SQL de Supabase
-- ==========================================

-- 1. Création des fonctions SECURITY DEFINER pour éviter la boucle de récursion
CREATE OR REPLACE FUNCTION public.is_member_of(_conversation_id uuid)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of(_conversation_id uuid)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. Suppression des anciennes politiques problématiques
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins can update group conversations" ON public.conversations;

DROP POLICY IF EXISTS "Users can view members of own conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can add members to conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.conversation_members;

DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.conversation_messages;
DROP POLICY IF EXISTS "Users can send messages in own conversations" ON public.conversation_messages;

-- 3. Recréation des politiques corrigées

-- CONVERSATIONS
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING ( created_by = auth.uid() OR public.is_member_of(id) );

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update group conversations" ON public.conversations
  FOR UPDATE USING ( public.is_admin_of(id) );

CREATE POLICY "Creators and Admins can delete conversations" ON public.conversations
  FOR DELETE USING ( 
    created_by = auth.uid() 
    OR public.is_admin_of(id)
    OR (type = 'dm' AND public.is_member_of(id))
    OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('founder', 'moderator')
  );

-- CONSTRAINT UNIQUE GROUP NAME
DROP INDEX IF EXISTS unique_group_name;
CREATE UNIQUE INDEX unique_group_name ON public.conversations (LOWER(name)) WHERE type = 'group';

-- CONVERSATION MEMBERS
CREATE POLICY "Users can view members of own conversations" ON public.conversation_members
  FOR SELECT USING ( public.is_member_of(conversation_id) );

CREATE POLICY "Users can add members to conversations" ON public.conversation_members
  FOR INSERT WITH CHECK (
    public.is_admin_of(conversation_id)
    OR 
    conversation_id IN (SELECT id FROM public.conversations WHERE created_by = auth.uid())
    OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('founder', 'moderator')
  );

CREATE POLICY "Admins can remove members" ON public.conversation_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR public.is_admin_of(conversation_id)
    OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('founder', 'moderator')
  );

-- CONVERSATION MESSAGES
CREATE POLICY "Users can view messages in own conversations" ON public.conversation_messages
  FOR SELECT USING ( public.is_member_of(conversation_id) );

CREATE POLICY "Users can send messages in own conversations" ON public.conversation_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND public.is_member_of(conversation_id)
  );

CREATE POLICY "Users can delete their own messages" ON public.conversation_messages
  FOR DELETE USING ( 
    auth.uid() = sender_id 
    OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('founder', 'moderator')
  );
