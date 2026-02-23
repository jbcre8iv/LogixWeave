-- Add mode column to ai_chat_conversations for chat vs troubleshoot separation
ALTER TABLE ai_chat_conversations
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'chat'
  CHECK (mode IN ('chat', 'troubleshoot'));

-- Composite index for filtered conversation list queries
CREATE INDEX idx_ai_chat_conversations_mode
  ON ai_chat_conversations (user_id, project_id, mode, updated_at DESC);
