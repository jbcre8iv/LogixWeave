-- Project sharing table
CREATE TABLE IF NOT EXISTS project_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(project_id, shared_with_email)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_shares_email ON project_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_project_shares_user ON project_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_project ON project_shares(project_id);

-- RLS policies for project_shares
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

-- Users can view shares for projects they own or are shared with them
CREATE POLICY "Users can view their project shares"
  ON project_shares FOR SELECT
  USING (
    invited_by = auth.uid()
    OR shared_with_user_id = auth.uid()
    OR shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Project owners can create shares
CREATE POLICY "Project owners can create shares"
  ON project_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND created_by = auth.uid()
    )
  );

-- Project owners can delete shares
CREATE POLICY "Project owners can delete shares"
  ON project_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND created_by = auth.uid()
    )
  );

-- Update projects RLS to allow shared access
-- First, drop the existing select policy if it exists
DROP POLICY IF EXISTS "Users can view projects in their organization" ON projects;

-- Create new policy that includes shared projects
CREATE POLICY "Users can view own and shared projects"
  ON projects FOR SELECT
  USING (
    -- User created the project
    created_by = auth.uid()
    -- Or user is in the same organization
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    -- Or project is shared with them
    OR id IN (
      SELECT project_id FROM project_shares
      WHERE shared_with_user_id = auth.uid()
      OR shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
