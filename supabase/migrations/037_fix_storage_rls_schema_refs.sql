-- Migration: Fix storage RLS policies broken by search_path changes
-- The storage policies reference projects, organization_members, project_shares,
-- and profiles without public. prefix. When these subqueries trigger RLS on those
-- tables, the inner RLS calls functions (is_org_member, check_project_owner) that
-- now have search_path=''. This causes the chain to break silently, blocking all
-- storage uploads with "new row violates row-level security policy".
--
-- Fix: Use public. qualified table references and existing SECURITY DEFINER helpers.

-- ============================================================================
-- 1. SELECT policy — use user_can_access_project() or platform admin
-- ============================================================================
DROP POLICY IF EXISTS "storage_select_project_files" ON storage.objects;
CREATE POLICY "storage_select_project_files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND (
      public.user_can_access_project((storage.foldername(name))[1]::uuid)
      OR public.is_platform_admin()
    )
  );

-- ============================================================================
-- 2. INSERT policy — org member, edit share, or platform admin
-- ============================================================================
DROP POLICY IF EXISTS "storage_insert_project_files" ON storage.objects;
CREATE POLICY "storage_insert_project_files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files'
    AND (
      -- Org member (bypass inner RLS via SECURITY DEFINER)
      public.is_org_member(
        (SELECT p.organization_id FROM public.projects p
         WHERE p.id = (storage.foldername(name))[1]::uuid)
      )
      -- Edit/owner share or project owner
      OR public.user_can_edit_project((storage.foldername(name))[1]::uuid)
      -- Platform admin
      OR public.is_platform_admin()
    )
  );

-- ============================================================================
-- 3. DELETE policy — org member, edit share, or platform admin
-- ============================================================================
DROP POLICY IF EXISTS "storage_delete_project_files" ON storage.objects;
CREATE POLICY "storage_delete_project_files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-files'
    AND (
      -- Org member
      public.is_org_member(
        (SELECT p.organization_id FROM public.projects p
         WHERE p.id = (storage.foldername(name))[1]::uuid)
      )
      -- Edit/owner share or project owner
      OR public.user_can_edit_project((storage.foldername(name))[1]::uuid)
      -- Platform admin
      OR public.is_platform_admin()
    )
  );

-- ============================================================================
-- 4. Fix project_files policies that reference functions without public. prefix
-- ============================================================================
DROP POLICY IF EXISTS "Users can view project files" ON public.project_files;
CREATE POLICY "Users can view project files"
  ON public.project_files FOR SELECT
  USING (public.user_can_access_project(project_id));

DROP POLICY IF EXISTS "Users can insert project files" ON public.project_files;
CREATE POLICY "Users can insert project files"
  ON public.project_files FOR INSERT
  WITH CHECK (public.user_can_edit_project(project_id));

DROP POLICY IF EXISTS "Users can update project files" ON public.project_files;
CREATE POLICY "Users can update project files"
  ON public.project_files FOR UPDATE
  USING (public.user_can_edit_project(project_id));

DROP POLICY IF EXISTS "Users can delete project files" ON public.project_files;
CREATE POLICY "Users can delete project files"
  ON public.project_files FOR DELETE
  USING (public.user_can_edit_project(project_id));

-- ============================================================================
-- 5. Fix file_versions INSERT policy
-- ============================================================================
DROP POLICY IF EXISTS "Users can insert versions for accessible files" ON public.file_versions;
CREATE POLICY "Users can insert versions for accessible files"
  ON public.file_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_files pf
      WHERE pf.id = file_versions.file_id
        AND public.user_can_edit_project(pf.project_id)
    )
    OR public.is_platform_admin()
  );
