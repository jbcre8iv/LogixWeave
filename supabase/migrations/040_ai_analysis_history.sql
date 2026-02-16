-- Migration: AI Analysis History
-- Persistent table storing every AI analysis run for trend awareness

CREATE TABLE ai_analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('explain', 'issues', 'search', 'health')),
  target TEXT,
  result JSONB NOT NULL,
  health_scores JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast timeline queries (project health history)
CREATE INDEX idx_ai_analysis_history_project_type
  ON ai_analysis_history(project_id, analysis_type, created_at DESC);

-- Index for user-level queries
CREATE INDEX idx_ai_analysis_history_user
  ON ai_analysis_history(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE ai_analysis_history ENABLE ROW LEVEL SECURITY;

-- RLS: Users can SELECT on projects they have access to (org members + accepted shares)
CREATE POLICY "Users can view analysis history for accessible projects"
  ON ai_analysis_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = ai_analysis_history.project_id
      AND om.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_shares ps
      WHERE ps.project_id = ai_analysis_history.project_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- Service role can manage all rows
CREATE POLICY "Service role can manage ai_analysis_history"
  ON ai_analysis_history FOR ALL
  USING (true)
  WITH CHECK (true);
