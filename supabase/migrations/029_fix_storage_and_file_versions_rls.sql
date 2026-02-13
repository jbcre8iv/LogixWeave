-- Migration: Fix overly-permissive storage bucket and file_versions RLS policies
-- Previously, any authenticated user could read/upload/delete any file in storage.
-- Now access requires project membership via org or accepted share.

-- ============================================================================
-- 1. Fix storage.objects policies for 'project-files' bucket
-- ============================================================================

-- Drop the 3 overly-permissive policies
DROP POLICY IF EXISTS "Users can upload files to their projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can read files from their projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files from their projects" ON storage.objects;

-- Helper: storage path format is {projectId}/{timestamp}-v{version}-{filename}
-- (storage.foldername(name))[1] extracts the first folder segment = projectId

-- SELECT: org member, any accepted share, or platform admin
CREATE POLICY "storage_select_project_files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND (
      -- Org member
      EXISTS (
        SELECT 1 FROM projects p
        JOIN organization_members om ON om.organization_id = p.organization_id
        WHERE p.id = (storage.foldername(name))[1]::uuid
          AND om.user_id = auth.uid()
      )
      -- Accepted share (view or edit)
      OR EXISTS (
        SELECT 1 FROM project_shares ps
        WHERE ps.project_id = (storage.foldername(name))[1]::uuid
          AND ps.shared_with_user_id = auth.uid()
          AND ps.accepted_at IS NOT NULL
      )
      -- Platform admin
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND is_platform_admin = true
      )
    )
  );

-- INSERT: org member, accepted edit/owner share, or platform admin
CREATE POLICY "storage_insert_project_files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files'
    AND (
      -- Org member
      EXISTS (
        SELECT 1 FROM projects p
        JOIN organization_members om ON om.organization_id = p.organization_id
        WHERE p.id = (storage.foldername(name))[1]::uuid
          AND om.user_id = auth.uid()
      )
      -- Accepted edit share
      OR EXISTS (
        SELECT 1 FROM project_shares ps
        WHERE ps.project_id = (storage.foldername(name))[1]::uuid
          AND ps.shared_with_user_id = auth.uid()
          AND ps.accepted_at IS NOT NULL
          AND ps.permission = 'edit'
      )
      -- Platform admin
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND is_platform_admin = true
      )
    )
  );

-- DELETE: org member, accepted edit share, or platform admin
CREATE POLICY "storage_delete_project_files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-files'
    AND (
      -- Org member
      EXISTS (
        SELECT 1 FROM projects p
        JOIN organization_members om ON om.organization_id = p.organization_id
        WHERE p.id = (storage.foldername(name))[1]::uuid
          AND om.user_id = auth.uid()
      )
      -- Accepted edit share
      OR EXISTS (
        SELECT 1 FROM project_shares ps
        WHERE ps.project_id = (storage.foldername(name))[1]::uuid
          AND ps.shared_with_user_id = auth.uid()
          AND ps.accepted_at IS NOT NULL
          AND ps.permission = 'edit'
      )
      -- Platform admin
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND is_platform_admin = true
      )
    )
  );

-- ============================================================================
-- 2. Fix file_versions INSERT policy
-- ============================================================================

-- Drop the permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert versions" ON file_versions;

-- Replace with project-access check via project_files join
CREATE POLICY "Users can insert versions for accessible files"
  ON file_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE pf.id = file_versions.file_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN project_shares ps ON ps.project_id = p.id
      WHERE pf.id = file_versions.file_id
        AND ps.shared_with_user_id = auth.uid()
        AND ps.accepted_at IS NOT NULL
        AND ps.permission = 'edit'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_platform_admin = true
    )
  );
