-- Enforce edit permissions for shared projects

-- First, update the permission check constraint to include 'owner'
ALTER TABLE project_shares DROP CONSTRAINT IF EXISTS project_shares_permission_check;
ALTER TABLE project_shares ADD CONSTRAINT project_shares_permission_check
  CHECK (permission IN ('view', 'edit', 'owner'));

-- Helper function to check if user has edit permission on a project
CREATE OR REPLACE FUNCTION user_can_edit_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- User is the creator
    SELECT 1 FROM projects WHERE id = project_uuid AND created_by = auth.uid()
  ) OR EXISTS (
    -- User has edit or owner permission via share
    SELECT 1 FROM project_shares
    WHERE project_id = project_uuid
    AND permission IN ('edit', 'owner')
    AND (
      shared_with_user_id = auth.uid()
      OR shared_with_email = auth.jwt() ->> 'email'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is an owner of a project
CREATE OR REPLACE FUNCTION user_is_project_owner(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- User is the creator
    SELECT 1 FROM projects WHERE id = project_uuid AND created_by = auth.uid()
  ) OR EXISTS (
    -- User has owner permission via share
    SELECT 1 FROM project_shares
    WHERE project_id = project_uuid
    AND permission = 'owner'
    AND (
      shared_with_user_id = auth.uid()
      OR shared_with_email = auth.jwt() ->> 'email'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update policy for projects (only owners and edit-permission users can update)
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
CREATE POLICY "Users can update projects with edit access"
  ON projects FOR UPDATE
  USING (user_can_edit_project(id));

-- RLS for project_files - viewers can see, editors can modify
-- First ensure RLS is enabled
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view project files" ON project_files;
DROP POLICY IF EXISTS "Users can insert project files" ON project_files;
DROP POLICY IF EXISTS "Users can update project files" ON project_files;
DROP POLICY IF EXISTS "Users can delete project files" ON project_files;

-- SELECT: Anyone with access to the project can view files
CREATE POLICY "Users can view project files"
  ON project_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_files.project_id
      AND (
        p.created_by = auth.uid()
        OR p.organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        OR p.id IN (
          SELECT project_id FROM project_shares
          WHERE shared_with_user_id = auth.uid()
          OR shared_with_email = auth.jwt() ->> 'email'
        )
      )
    )
  );

-- INSERT: Only owners and editors can add files
CREATE POLICY "Users can insert project files"
  ON project_files FOR INSERT
  WITH CHECK (user_can_edit_project(project_id));

-- UPDATE: Only owners and editors can update files
CREATE POLICY "Users can update project files"
  ON project_files FOR UPDATE
  USING (user_can_edit_project(project_id));

-- DELETE: Only owners and editors can delete files
CREATE POLICY "Users can delete project files"
  ON project_files FOR DELETE
  USING (user_can_edit_project(project_id));

-- Similar policies for parsed data tables (tags, routines, io_modules)
-- These are typically only modified by the system during parsing,
-- but we should still protect them

-- parsed_tags
ALTER TABLE parsed_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view parsed tags" ON parsed_tags;
CREATE POLICY "Users can view parsed tags"
  ON parsed_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON p.id = pf.project_id
      WHERE pf.id = parsed_tags.file_id
      AND (
        p.created_by = auth.uid()
        OR p.organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        OR p.id IN (
          SELECT project_id FROM project_shares
          WHERE shared_with_user_id = auth.uid()
          OR shared_with_email = auth.jwt() ->> 'email'
        )
      )
    )
  );

-- parsed_routines
ALTER TABLE parsed_routines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view parsed routines" ON parsed_routines;
CREATE POLICY "Users can view parsed routines"
  ON parsed_routines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON p.id = pf.project_id
      WHERE pf.id = parsed_routines.file_id
      AND (
        p.created_by = auth.uid()
        OR p.organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        OR p.id IN (
          SELECT project_id FROM project_shares
          WHERE shared_with_user_id = auth.uid()
          OR shared_with_email = auth.jwt() ->> 'email'
        )
      )
    )
  );

-- parsed_io_modules
ALTER TABLE parsed_io_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view parsed io modules" ON parsed_io_modules;
CREATE POLICY "Users can view parsed io modules"
  ON parsed_io_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON p.id = pf.project_id
      WHERE pf.id = parsed_io_modules.file_id
      AND (
        p.created_by = auth.uid()
        OR p.organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
        OR p.id IN (
          SELECT project_id FROM project_shares
          WHERE shared_with_user_id = auth.uid()
          OR shared_with_email = auth.jwt() ->> 'email'
        )
      )
    )
  );
