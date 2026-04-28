-- ==========================================
-- MIGRATION: SYSTÈME DE MESSAGERIE AVANCÉE
-- Tables pour DM + Groupes style WhatsApp
-- A copier/coller dans l'éditeur SQL de Supabase
-- ==========================================

-- 1. Table des conversations (unifie DM et Groupes)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('dm', 'group')),
  name TEXT,                -- Nom du groupe (NULL pour DMs)
  avatar_url TEXT,          -- Avatar du groupe (NULL pour DMs)
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Politique: un utilisateur voit uniquement les conversations dont il est membre
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (
    id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update group conversations" ON public.conversations
  FOR UPDATE USING (
    id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid() AND role = 'admin')
  );


-- 2. Membres des conversations
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- Politique: un utilisateur peut voir les membres de ses conversations
CREATE POLICY "Users can view members of own conversations" ON public.conversation_members
  FOR SELECT USING (
    conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can add members to conversations" ON public.conversation_members
  FOR INSERT WITH CHECK (
    conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid() AND role = 'admin')
    OR 
    conversation_id IN (SELECT id FROM public.conversations WHERE created_by = auth.uid())
  );

CREATE POLICY "Admins can remove members" ON public.conversation_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid() AND role = 'admin')
  );


-- 3. Messages dans les conversations 
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Politique: un utilisateur peut voir les messages de ses conversations
CREATE POLICY "Users can view messages in own conversations" ON public.conversation_messages
  FOR SELECT USING (
    conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can send messages in own conversations" ON public.conversation_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid())
  );


-- ==========================================
-- INDEX POUR PERFORMANCES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created ON public.conversation_messages(created_at);
