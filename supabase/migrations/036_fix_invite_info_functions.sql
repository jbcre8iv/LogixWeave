-- Migration: Fix get_project_info_for_invite and get_inviter_info
-- These SECURITY DEFINER functions were broken by migration 034 which set
-- search_path='' but their bodies still referenced tables without public. prefix.
-- Migration 035 fixed 13 other functions but missed these two.

-- ============================================================================
-- 1. get_project_info_for_invite(UUID)
--    Returns project id and name for a pending invite display.
--    SECURITY DEFINER so the invited user can see the project name before accepting.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_project_info_for_invite(project_uuid UUID)
RETURNS TABLE(id UUID, name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name
  FROM public.projects p
  WHERE p.id = project_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 2. get_inviter_info(UUID)
--    Returns inviter's full_name and email for a pending invite display.
--    SECURITY DEFINER so the invited user can see who invited them before accepting.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_inviter_info(inviter_uuid UUID)
RETURNS TABLE(full_name TEXT, email TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.full_name, p.email
  FROM public.profiles p
  WHERE p.id = inviter_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
