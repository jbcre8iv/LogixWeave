-- Fix storage and file_versions RLS regression from migration 049.
-- Migration 049 replaced SECURITY DEFINER helper functions with raw inline SQL
-- in the storage INSERT/DELETE and file_versions INSERT policies. This reintroduced
-- the nested-RLS/search_path bug that migration 037 originally fixed, blocking all
-- storage uploads with "new row violates row-level security policy".
--
-- Fix: Restore the SECURITY DEFINER function-based approach from migration 037.
-- user_can_edit_project() already checks permission IN ('edit', 'owner'), so the
-- 'owner' permission support from 049 is preserved.

-- ============================================================================
-- 1. Storage INSERT policy — restore SECURITY DEFINER helpers
-- ============================================================================
DROP POLICY IF EXISTS "storage_insert_project_files" ON storage.objects;
CREATE POLICY "storage_insert_project_files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files'
    AND (
      public.is_org_member(
        (SELECT p.organization_id FROM public.projects p
         WHERE p.id = (storage.foldername(name))[1]::uuid)
      )
      OR public.user_can_edit_project((storage.foldername(name))[1]::uuid)
      OR public.is_platform_admin()
    )
  );

-- ============================================================================
-- 2. Storage DELETE policy — restore SECURITY DEFINER helpers
-- ============================================================================
DROP POLICY IF EXISTS "storage_delete_project_files" ON storage.objects;
CREATE POLICY "storage_delete_project_files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-files'
    AND (
      public.is_org_member(
        (SELECT p.organization_id FROM public.projects p
         WHERE p.id = (storage.foldername(name))[1]::uuid)
      )
      OR public.user_can_edit_project((storage.foldername(name))[1]::uuid)
      OR public.is_platform_admin()
    )
  );

-- ============================================================================
-- 3. File versions INSERT policy — restore SECURITY DEFINER helper
-- ============================================================================
DROP POLICY IF EXISTS "Users can insert versions for accessible files" ON file_versions;
CREATE POLICY "Users can insert versions for accessible files"
  ON public.file_versions FOR INSERT
  WITH CHECK (
    public.user_can_edit_project(
      (SELECT pf.project_id FROM public.project_files pf WHERE pf.id = file_versions.file_id)
    )
    OR public.is_platform_admin()
  );
