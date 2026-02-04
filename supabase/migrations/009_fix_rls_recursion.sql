-- Fix RLS infinite recursion by using SECURITY DEFINER functions
-- instead of subqueries that reference other tables with RLS

-- Helper function to check project ownership (bypasses RLS)
CREATE OR REPLACE FUNCTION check_project_owner(project_uuid UUID)
RETURNS UUID AS $$
  SELECT created_by FROM projects WHERE id = project_uuid;
$$ LANGUAGE sql SECURITY DEFINER;

-- Update the policy for viewing project shares to use the helper function
DROP POLICY IF EXISTS "Owners can view project shares" ON project_shares;
CREATE POLICY "Owners can view project shares"
  ON project_shares FOR SELECT
  USING (check_project_owner(project_id) = auth.uid());

-- Update insert policy
DROP POLICY IF EXISTS "Owners can insert project shares" ON project_shares;
CREATE POLICY "Owners can insert project shares"
  ON project_shares FOR INSERT
  WITH CHECK (check_project_owner(project_id) = auth.uid());

-- Update owner update policy
DROP POLICY IF EXISTS "Owners can update project shares" ON project_shares;
CREATE POLICY "Owners can update project shares"
  ON project_shares FOR UPDATE
  USING (check_project_owner(project_id) = auth.uid());

-- Update owner delete policy
DROP POLICY IF EXISTS "Owners can delete project shares" ON project_shares;
CREATE POLICY "Owners can delete project shares"
  ON project_shares FOR DELETE
  USING (check_project_owner(project_id) = auth.uid());

-- Simplify the projects SELECT policy to avoid recursion
DROP POLICY IF EXISTS "Users can view own and shared projects" ON projects;
CREATE POLICY "Users can view own and shared projects"
  ON projects FOR SELECT
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_shares
      WHERE project_shares.project_id = projects.id
      AND project_shares.accepted_at IS NOT NULL
      AND (
        project_shares.shared_with_user_id = auth.uid()
        OR project_shares.shared_with_email = auth.jwt() ->> 'email'
      )
    )
  );
