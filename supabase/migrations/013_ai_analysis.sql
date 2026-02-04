-- Migration: AI Analysis Tables
-- Adds tables for caching AI analysis results and tracking usage

-- Create ai_analysis_cache table for caching AI analysis results
CREATE TABLE ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('explain', 'issues', 'search')),
  target TEXT NOT NULL, -- routine name, rung number, or search query
  input_hash TEXT NOT NULL, -- hash of input content for cache validation
  result JSONB NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

-- Create ai_usage_log table for tracking API usage
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cached BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_ai_analysis_cache_file_id ON ai_analysis_cache(file_id);
CREATE INDEX idx_ai_analysis_cache_lookup ON ai_analysis_cache(file_id, analysis_type, target, input_hash);
CREATE INDEX idx_ai_analysis_cache_expires ON ai_analysis_cache(expires_at);

CREATE INDEX idx_ai_usage_log_user_id ON ai_usage_log(user_id);
CREATE INDEX idx_ai_usage_log_org_id ON ai_usage_log(organization_id);
CREATE INDEX idx_ai_usage_log_created_at ON ai_usage_log(created_at);

-- Enable Row Level Security
ALTER TABLE ai_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_analysis_cache
CREATE POLICY "Users can view cached analysis from files they can access"
  ON ai_analysis_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE pf.id = ai_analysis_cache.file_id
      AND om.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE pf.id = ai_analysis_cache.file_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Service role can manage ai_analysis_cache"
  ON ai_analysis_cache FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for ai_usage_log
CREATE POLICY "Users can view their own usage logs"
  ON ai_usage_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view org usage logs"
  ON ai_usage_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = ai_usage_log.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role can insert usage logs"
  ON ai_usage_log FOR INSERT
  WITH CHECK (true);

-- Function to clean up expired cache entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_ai_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_analysis_cache
  WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
