-- Fix RLS policies on all tables that are missing a projects.created_by check.
-- When ownership is transferred, the new creator may not have org membership or
-- a share for the project, so policies that only check those two paths silently
-- filter out all rows. Add a creator path to every affected table.
--
-- Tables using user_can_access_project() (parsed_tags, parsed_routines, parsed_io_modules,
-- project_files) already have the creator check via that function — no change needed.

-- ============================================================
-- 1. tag_references  (migration 011)
-- ============================================================
DROP POLICY IF EXISTS "Users can view tag references from files in their org projects" ON tag_references;

CREATE POLICY "Users can view tag references from accessible projects"
  ON tag_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      WHERE pf.id = tag_references.file_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE pf.id = tag_references.file_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN project_shares ps ON pf.project_id = ps.project_id
      WHERE pf.id = tag_references.file_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- ============================================================
-- 2. parsed_rungs  (migration 011)
-- ============================================================
DROP POLICY IF EXISTS "Users can view rungs from files in their org projects" ON parsed_rungs;

CREATE POLICY "Users can view rungs from accessible projects"
  ON parsed_rungs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      WHERE pf.id = parsed_rungs.file_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE pf.id = parsed_rungs.file_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN project_shares ps ON pf.project_id = ps.project_id
      WHERE pf.id = parsed_rungs.file_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- ============================================================
-- 3. parsed_tasks  (migration 048)
-- ============================================================
DROP POLICY IF EXISTS "Users can view tasks from their project files" ON parsed_tasks;
DROP POLICY IF EXISTS "Shared users can view tasks" ON parsed_tasks;

CREATE POLICY "Users can view tasks from accessible projects"
  ON parsed_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      WHERE pf.id = parsed_tasks.file_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE pf.id = parsed_tasks.file_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN project_shares ps ON pf.project_id = ps.project_id
      WHERE pf.id = parsed_tasks.file_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- ============================================================
-- 4. parsed_udts  (migration 011)
-- ============================================================
DROP POLICY IF EXISTS "Users can view UDTs from files in their org projects" ON parsed_udts;

CREATE POLICY "Users can view UDTs from accessible projects"
  ON parsed_udts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      WHERE pf.id = parsed_udts.file_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE pf.id = parsed_udts.file_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN project_shares ps ON pf.project_id = ps.project_id
      WHERE pf.id = parsed_udts.file_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- ============================================================
-- 5. parsed_udt_members  (migration 011)
-- ============================================================
DROP POLICY IF EXISTS "Users can view UDT members from UDTs they can access" ON parsed_udt_members;

CREATE POLICY "Users can view UDT members from accessible projects"
  ON parsed_udt_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parsed_udts udt
      JOIN project_files pf ON udt.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      WHERE udt.id = parsed_udt_members.udt_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM parsed_udts udt
      JOIN project_files pf ON udt.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE udt.id = parsed_udt_members.udt_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM parsed_udts udt
      JOIN project_files pf ON udt.file_id = pf.id
      JOIN project_shares ps ON pf.project_id = ps.project_id
      WHERE udt.id = parsed_udt_members.udt_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- ============================================================
-- 6. parsed_aois  (migration 011)
-- ============================================================
DROP POLICY IF EXISTS "Users can view AOIs from files in their org projects" ON parsed_aois;

CREATE POLICY "Users can view AOIs from accessible projects"
  ON parsed_aois FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      WHERE pf.id = parsed_aois.file_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE pf.id = parsed_aois.file_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN project_shares ps ON pf.project_id = ps.project_id
      WHERE pf.id = parsed_aois.file_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- ============================================================
-- 7. parsed_aoi_parameters  (migration 011)
-- ============================================================
DROP POLICY IF EXISTS "Users can view AOI parameters from AOIs they can access" ON parsed_aoi_parameters;

CREATE POLICY "Users can view AOI parameters from accessible projects"
  ON parsed_aoi_parameters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      WHERE aoi.id = parsed_aoi_parameters.aoi_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE aoi.id = parsed_aoi_parameters.aoi_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN project_shares ps ON pf.project_id = ps.project_id
      WHERE aoi.id = parsed_aoi_parameters.aoi_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- ============================================================
-- 8. parsed_aoi_local_tags  (migration 011)
-- ============================================================
DROP POLICY IF EXISTS "Users can view AOI local tags from AOIs they can access" ON parsed_aoi_local_tags;

CREATE POLICY "Users can view AOI local tags from accessible projects"
  ON parsed_aoi_local_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      WHERE aoi.id = parsed_aoi_local_tags.aoi_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE aoi.id = parsed_aoi_local_tags.aoi_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN project_shares ps ON pf.project_id = ps.project_id
      WHERE aoi.id = parsed_aoi_local_tags.aoi_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- ============================================================
-- 9. parsed_aoi_routines  (migration 011)
-- ============================================================
DROP POLICY IF EXISTS "Users can view AOI routines from AOIs they can access" ON parsed_aoi_routines;

CREATE POLICY "Users can view AOI routines from accessible projects"
  ON parsed_aoi_routines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      WHERE aoi.id = parsed_aoi_routines.aoi_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE aoi.id = parsed_aoi_routines.aoi_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN project_shares ps ON pf.project_id = ps.project_id
      WHERE aoi.id = parsed_aoi_routines.aoi_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- ============================================================
-- 10. project_activity_log  (migration 014)
-- ============================================================
DROP POLICY IF EXISTS "Users can view activity for projects in their org" ON project_activity_log;

CREATE POLICY "Users can view activity for accessible projects"
  ON project_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_activity_log.project_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = project_activity_log.project_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_shares ps
      WHERE ps.project_id = project_activity_log.project_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- ============================================================
-- 11. ai_analysis_history  (migration 040)
-- ============================================================
DROP POLICY IF EXISTS "Users can view analysis history for accessible projects" ON ai_analysis_history;

CREATE POLICY "Users can view analysis history for accessible projects"
  ON ai_analysis_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = ai_analysis_history.project_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE p.id = ai_analysis_history.project_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_shares ps
      WHERE ps.project_id = ai_analysis_history.project_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

-- ============================================================
-- 12. ai_analysis_cache  (migration 013)
-- ============================================================
DROP POLICY IF EXISTS "Users can view cached analysis from files they can access" ON ai_analysis_cache;

CREATE POLICY "Users can view cached analysis from accessible projects"
  ON ai_analysis_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      WHERE pf.id = ai_analysis_cache.file_id
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE pf.id = ai_analysis_cache.file_id
      AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN project_shares ps ON pf.project_id = ps.project_id
      WHERE pf.id = ai_analysis_cache.file_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );
