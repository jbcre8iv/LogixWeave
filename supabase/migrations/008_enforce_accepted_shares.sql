-- Enforce that shared project access requires accepted_at to be set
-- This ensures users must accept invites before accessing shared projects

-- Update the helper function to check for accepted shares only
CREATE OR REPLACE FUNCTION user_can_edit_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- User is the creator
    SELECT 1 FROM projects WHERE id = project_uuid AND created_by = auth.uid()
  ) OR EXISTS (
    -- User has edit or owner permission via ACCEPTED share
    SELECT 1 FROM project_shares
    WHERE project_id = project_uuid
    AND permission IN ('edit', 'owner')
    AND accepted_at IS NOT NULL
    AND (
      shared_with_user_id = auth.uid()
      OR shared_with_email = auth.jwt() ->> 'email'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the owner check function to require accepted shares
CREATE OR REPLACE FUNCTION user_is_project_owner(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- User is the creator
    SELECT 1 FROM projects WHERE id = project_uuid AND created_by = auth.uid()
  ) OR EXISTS (
    -- User has owner permission via ACCEPTED share
    SELECT 1 FROM project_shares
    WHERE project_id = project_uuid
    AND permission = 'owner'
    AND accepted_at IS NOT NULL
    AND (
      shared_with_user_id = auth.uid()
      OR shared_with_email = auth.jwt() ->> 'email'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has any access to a project (including view)
CREATE OR REPLACE FUNCTION user_can_access_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- User is the creator
    SELECT 1 FROM projects WHERE id = project_uuid AND created_by = auth.uid()
  ) OR EXISTS (
    -- User is in the project's organization
    SELECT 1 FROM projects p
    JOIN organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = project_uuid AND om.user_id = auth.uid()
  ) OR EXISTS (
    -- User has an ACCEPTED share
    SELECT 1 FROM project_shares
    WHERE project_id = project_uuid
    AND accepted_at IS NOT NULL
    AND (
      shared_with_user_id = auth.uid()
      OR shared_with_email = auth.jwt() ->> 'email'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update project_files SELECT policy to use helper function
DROP POLICY IF EXISTS "Users can view project files" ON project_files;
CREATE POLICY "Users can view project files"
  ON project_files FOR SELECT
  USING (user_can_access_project(project_id));

-- Update parsed_tags SELECT policy
DROP POLICY IF EXISTS "Users can view parsed tags" ON parsed_tags;
CREATE POLICY "Users can view parsed tags"
  ON parsed_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      WHERE pf.id = parsed_tags.file_id
      AND user_can_access_project(pf.project_id)
    )
  );

-- Update parsed_routines SELECT policy
DROP POLICY IF EXISTS "Users can view parsed routines" ON parsed_routines;
CREATE POLICY "Users can view parsed routines"
  ON parsed_routines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      WHERE pf.id = parsed_routines.file_id
      AND user_can_access_project(pf.project_id)
    )
  );

-- Update parsed_io_modules SELECT policy
DROP POLICY IF EXISTS "Users can view parsed io modules" ON parsed_io_modules;
CREATE POLICY "Users can view parsed io modules"
  ON parsed_io_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      WHERE pf.id = parsed_io_modules.file_id
      AND user_can_access_project(pf.project_id)
    )
  );

-- Update projects SELECT policy to require accepted shares
DROP POLICY IF EXISTS "Users can view projects" ON projects;
DROP POLICY IF EXISTS "Users can view own and shared projects" ON projects;
CREATE POLICY "Users can view own and shared projects"
  ON projects FOR SELECT
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    OR id IN (
      SELECT project_id FROM project_shares
      WHERE accepted_at IS NOT NULL
      AND (shared_with_user_id = auth.uid() OR shared_with_email = auth.jwt() ->> 'email')
    )
  );

-- Policy for users to view their own pending invites (but not project content)
-- This allows the invite acceptance flow to work
DROP POLICY IF EXISTS "Users can view own shares" ON project_shares;
CREATE POLICY "Users can view own shares"
  ON project_shares FOR SELECT
  USING (
    shared_with_user_id = auth.uid()
    OR shared_with_email = auth.jwt() ->> 'email'
  );

-- Owners can view all shares for their projects
DROP POLICY IF EXISTS "Owners can view project shares" ON project_shares;
CREATE POLICY "Owners can view project shares"
  ON project_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_shares.project_id
      AND created_by = auth.uid()
    )
  );

-- Users can update their own shares (to accept invites)
DROP POLICY IF EXISTS "Users can update own shares" ON project_shares;
CREATE POLICY "Users can update own shares"
  ON project_shares FOR UPDATE
  USING (
    shared_with_user_id = auth.uid()
    OR shared_with_email = auth.jwt() ->> 'email'
  );

-- Owners can manage shares for their projects
DROP POLICY IF EXISTS "Owners can manage project shares" ON project_shares;
CREATE POLICY "Owners can insert project shares"
  ON project_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_shares.project_id
      AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update project shares" ON project_shares;
CREATE POLICY "Owners can update project shares"
  ON project_shares FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_shares.project_id
      AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can delete project shares" ON project_shares;
CREATE POLICY "Owners can delete project shares"
  ON project_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_shares.project_id
      AND created_by = auth.uid()
    )
  );

-- Users can delete their own shares (to decline invites)
DROP POLICY IF EXISTS "Users can delete own shares" ON project_shares;
CREATE POLICY "Users can delete own shares"
  ON project_shares FOR DELETE
  USING (
    shared_with_user_id = auth.uid()
    OR shared_with_email = auth.jwt() ->> 'email'
  );
