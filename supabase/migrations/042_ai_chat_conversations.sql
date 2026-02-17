-- AI Chat Conversations: persistent conversation history for project chat

-- Conversations table
CREATE TABLE IF NOT EXISTS public.ai_chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_chat_conversations_user_project
    ON public.ai_chat_conversations (user_id, project_id, updated_at DESC);

CREATE INDEX idx_ai_chat_messages_conversation
    ON public.ai_chat_messages (conversation_id, created_at ASC);

-- Reuse existing trigger function for updated_at
CREATE TRIGGER update_ai_chat_conversations_updated_at
    BEFORE UPDATE ON public.ai_chat_conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: ai_chat_conversations (user-private)
ALTER TABLE public.ai_chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
    ON public.ai_chat_conversations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create own conversations"
    ON public.ai_chat_conversations FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
    ON public.ai_chat_conversations FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own conversations"
    ON public.ai_chat_conversations FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Service role bypass conversations"
    ON public.ai_chat_conversations FOR ALL
    USING (auth.role() = 'service_role');

-- RLS: ai_chat_messages (via parent conversation ownership)
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages of own conversations"
    ON public.ai_chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.ai_chat_conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role bypass messages"
    ON public.ai_chat_messages FOR ALL
    USING (auth.role() = 'service_role');
