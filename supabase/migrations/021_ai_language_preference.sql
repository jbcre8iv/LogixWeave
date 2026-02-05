-- Migration: AI Language Preference
-- Allows users to choose their preferred language for AI responses

-- Add ai_language column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS ai_language TEXT DEFAULT 'en';

-- Add comment explaining the values
COMMENT ON COLUMN profiles.ai_language IS 'User preferred language for AI responses: en (English), it (Italian), es (Spanish)';
