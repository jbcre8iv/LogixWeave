-- Migration: Fix function search_path warnings and permissive RLS policies
-- 1. Set search_path = '' on all public functions (prevents search_path injection)
-- 2. Drop "WITH CHECK (true)" / "USING (true)" policies on service-role-only tables
--    (service role bypasses RLS anyway, so these policies only weaken security)
-- 3. Restrict org INSERT to authenticated users only

-- ============================================================================
-- 1. Fix function search_path (immutable search_path prevents privilege escalation)
-- ============================================================================

ALTER FUNCTION public.is_platform_admin() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.is_org_member(UUID) SET search_path = '';
ALTER FUNCTION public.user_can_edit_project(UUID) SET search_path = '';
ALTER FUNCTION public.user_is_project_owner(UUID) SET search_path = '';
ALTER FUNCTION public.notify_on_permission_request() SET search_path = '';
ALTER FUNCTION public.notify_project_collaborators() SET search_path = '';
ALTER FUNCTION public.notify_on_permission_review() SET search_path = '';
ALTER FUNCTION public.user_can_access_project(UUID) SET search_path = '';
ALTER FUNCTION public.check_project_owner(UUID) SET search_path = '';
ALTER FUNCTION public.get_project_info_for_invite(UUID) SET search_path = '';
ALTER FUNCTION public.get_inviter_info(UUID) SET search_path = '';
ALTER FUNCTION public.notify_on_invite_accepted() SET search_path = '';
ALTER FUNCTION public.create_default_naming_rules() SET search_path = '';
ALTER FUNCTION public.cleanup_expired_ai_cache() SET search_path = '';

-- ============================================================================
-- 2. Drop permissive "service role" RLS policies
--    Service role bypasses RLS, so these WITH CHECK (true) / USING (true) policies
--    only allow ANY authenticated user to insert/delete — not the intent.
-- ============================================================================

-- ai_analysis_cache: drop the ALL policy (service role doesn't need it)
DROP POLICY IF EXISTS "Service role can manage ai_analysis_cache" ON ai_analysis_cache;

-- ai_usage_log: drop permissive INSERT
DROP POLICY IF EXISTS "Service role can insert usage logs" ON ai_usage_log;

-- parsed_rungs
DROP POLICY IF EXISTS "Service role can insert rungs" ON parsed_rungs;
DROP POLICY IF EXISTS "Service role can delete rungs" ON parsed_rungs;

-- tag_references
DROP POLICY IF EXISTS "Service role can insert tag references" ON tag_references;
DROP POLICY IF EXISTS "Service role can delete tag references" ON tag_references;

-- parsed_udts
DROP POLICY IF EXISTS "Service role can insert UDTs" ON parsed_udts;
DROP POLICY IF EXISTS "Service role can delete UDTs" ON parsed_udts;

-- parsed_udt_members
DROP POLICY IF EXISTS "Service role can insert UDT members" ON parsed_udt_members;
DROP POLICY IF EXISTS "Service role can delete UDT members" ON parsed_udt_members;

-- parsed_aois
DROP POLICY IF EXISTS "Service role can insert AOIs" ON parsed_aois;
DROP POLICY IF EXISTS "Service role can delete AOIs" ON parsed_aois;

-- parsed_aoi_parameters
DROP POLICY IF EXISTS "Service role can insert AOI parameters" ON parsed_aoi_parameters;
DROP POLICY IF EXISTS "Service role can delete AOI parameters" ON parsed_aoi_parameters;

-- parsed_aoi_local_tags
DROP POLICY IF EXISTS "Service role can insert AOI local tags" ON parsed_aoi_local_tags;
DROP POLICY IF EXISTS "Service role can delete AOI local tags" ON parsed_aoi_local_tags;

-- parsed_aoi_routines
DROP POLICY IF EXISTS "Service role can insert AOI routines" ON parsed_aoi_routines;
DROP POLICY IF EXISTS "Service role can delete AOI routines" ON parsed_aoi_routines;

-- ============================================================================
-- 3. Fix organizations INSERT policy — restrict to authenticated users
-- ============================================================================

DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
