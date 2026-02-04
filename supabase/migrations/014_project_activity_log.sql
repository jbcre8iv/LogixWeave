-- Migration: Project Activity Log
-- Tracks all changes, updates, additions, deletions for audit purposes

-- Create project_activity_log table
CREATE TABLE project_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT, -- Store email in case user is deleted
  action TEXT NOT NULL,
  target_type TEXT, -- 'file', 'project', 'share', 'tag', etc.
  target_id UUID,
  target_name TEXT, -- Human readable name for the target
  metadata JSONB DEFAULT '{}', -- Additional details
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_project_activity_log_project_id ON project_activity_log(project_id);
CREATE INDEX idx_project_activity_log_created_at ON project_activity_log(created_at DESC);
CREATE INDEX idx_project_activity_log_user_id ON project_activity_log(user_id);
CREATE INDEX idx_project_activity_log_action ON project_activity_log(action);

-- Enable Row Level Security
ALTER TABLE project_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only view activity for projects they have access to
CREATE POLICY "Users can view activity for projects in their org"
  ON project_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = project_activity_log.project_id
      AND om.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM projects p
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE p.id = project_activity_log.project_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- Only service role can insert (via API)
CREATE POLICY "Service role can insert activity logs"
  ON project_activity_log FOR INSERT
  WITH CHECK (true);

-- No updates or deletes allowed (immutable log)
-- Intentionally no UPDATE or DELETE policies

-- Add comment to explain the table purpose
COMMENT ON TABLE project_activity_log IS 'Immutable audit log tracking all project activity for collaboration tracking';
COMMENT ON COLUMN project_activity_log.action IS 'Action type: project_created, project_updated, file_uploaded, file_deleted, file_parsed, project_shared, share_accepted, share_revoked, etc.';
