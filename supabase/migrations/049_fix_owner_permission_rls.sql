-- Fix RLS policies that only check for 'edit' permission, excluding 'owner'
-- Users with 'owner' share permission should have the same write access as 'edit'

-- 1. Storage INSERT policy
DROP POLICY IF EXISTS "storage_insert_project_files" ON storage.objects;
CREATE POLICY "storage_insert_project_files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files'
    AND (
      EXISTS (
        SELECT 1 FROM projects p
        JOIN organization_members om ON om.organization_id = p.organization_id
        WHERE p.id = (storage.foldername(name))[1]::uuid
          AND om.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM project_shares ps
        WHERE ps.project_id = (storage.foldername(name))[1]::uuid
          AND ps.shared_with_user_id = auth.uid()
          AND ps.accepted_at IS NOT NULL
          AND ps.permission IN ('edit', 'owner')
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND is_platform_admin = true
      )
    )
  );

-- 2. Storage DELETE policy
DROP POLICY IF EXISTS "storage_delete_project_files" ON storage.objects;
CREATE POLICY "storage_delete_project_files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-files'
    AND (
      EXISTS (
        SELECT 1 FROM projects p
        JOIN organization_members om ON om.organization_id = p.organization_id
        WHERE p.id = (storage.foldername(name))[1]::uuid
          AND om.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM project_shares ps
        WHERE ps.project_id = (storage.foldername(name))[1]::uuid
          AND ps.shared_with_user_id = auth.uid()
          AND ps.accepted_at IS NOT NULL
          AND ps.permission IN ('edit', 'owner')
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND is_platform_admin = true
      )
    )
  );

-- 3. File versions INSERT policy
DROP POLICY IF EXISTS "Users can insert versions for accessible files" ON file_versions;
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
        AND ps.permission IN ('edit', 'owner')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_platform_admin = true
    )
  );
