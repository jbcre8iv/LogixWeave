-- Migration: User Session Tracking
-- Adds last_seen_at tracking for activity summaries

-- Add last_seen_at to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Create project_user_sessions table to track per-project visits
CREATE TABLE project_user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Create indexes
CREATE INDEX idx_project_user_sessions_project_id ON project_user_sessions(project_id);
CREATE INDEX idx_project_user_sessions_user_id ON project_user_sessions(user_id);

-- Enable Row Level Security
ALTER TABLE project_user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sessions"
  ON project_user_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own sessions"
  ON project_user_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
  ON project_user_sessions FOR UPDATE
  USING (user_id = auth.uid());
