-- Migration: Fix functions broken by search_path = ''
-- Migration 034 set search_path='' on all functions, but most reference tables
-- without schema qualification. This recreates them with public. prefixes.

-- ============================================================================
-- 1. is_platform_admin() — used in many RLS policies
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND is_platform_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 2. is_org_member(UUID) — used in org/project RLS policies
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = org_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 3. user_can_edit_project(UUID)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_edit_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects WHERE id = project_uuid AND created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.project_shares
    WHERE project_id = project_uuid
    AND permission IN ('edit', 'owner')
    AND accepted_at IS NOT NULL
    AND (
      shared_with_user_id = auth.uid()
      OR shared_with_email = auth.jwt() ->> 'email'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 4. user_is_project_owner(UUID)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_is_project_owner(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects WHERE id = project_uuid AND created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.project_shares
    WHERE project_id = project_uuid
    AND permission = 'owner'
    AND accepted_at IS NOT NULL
    AND (
      shared_with_user_id = auth.uid()
      OR shared_with_email = auth.jwt() ->> 'email'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 5. user_can_access_project(UUID)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_access_project(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects WHERE id = project_uuid AND created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = project_uuid AND om.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.project_shares
    WHERE project_id = project_uuid
    AND accepted_at IS NOT NULL
    AND (
      shared_with_user_id = auth.uid()
      OR shared_with_email = auth.jwt() ->> 'email'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 6. check_project_owner(UUID)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_project_owner(project_uuid UUID)
RETURNS UUID AS $$
  SELECT created_by FROM public.projects WHERE id = project_uuid;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 7. handle_new_user() — already had public. prefixes, just re-set search_path
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, first_name, last_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 8. notify_on_permission_request()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_permission_request()
RETURNS TRIGGER AS $$
DECLARE
  project_name TEXT;
  requester_name TEXT;
  owner_id UUID;
BEGIN
  SELECT name, created_by INTO project_name, owner_id FROM public.projects WHERE id = NEW.project_id;

  SELECT COALESCE(full_name, email) INTO requester_name
  FROM public.profiles WHERE id = NEW.requester_id;

  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (
    owner_id,
    'general',
    'Permission request',
    requester_name || ' requested ' || NEW.requested_permission || ' access to "' || project_name || '"',
    '/dashboard/projects/' || NEW.project_id,
    jsonb_build_object('request_id', NEW.id, 'requester_id', NEW.requester_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 9. notify_on_permission_review()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_permission_review()
RETURNS TRIGGER AS $$
DECLARE
  project_name TEXT;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT name INTO project_name FROM public.projects WHERE id = NEW.project_id;

    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      NEW.requester_id,
      'general',
      'Permission request ' || NEW.status,
      'Your request for ' || NEW.requested_permission || ' access to "' || project_name || '" was ' || NEW.status,
      '/dashboard/projects/' || NEW.project_id,
      jsonb_build_object('request_id', NEW.id, 'status', NEW.status)
    );

    IF NEW.status = 'approved' THEN
      UPDATE public.project_shares
      SET permission = NEW.requested_permission
      WHERE project_id = NEW.project_id
      AND (shared_with_user_id = NEW.requester_id OR shared_with_email = (SELECT email FROM public.profiles WHERE id = NEW.requester_id));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 10. notify_on_invite_accepted()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_invite_accepted()
RETURNS TRIGGER AS $$
DECLARE
  project_name TEXT;
  project_owner_id UUID;
  accepter_name TEXT;
BEGIN
  IF OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
    SELECT name, created_by INTO project_name, project_owner_id
    FROM public.projects WHERE id = NEW.project_id;

    SELECT COALESCE(full_name, email) INTO accepter_name
    FROM public.profiles WHERE id = NEW.shared_with_user_id;

    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      project_owner_id,
      'share_accepted',
      'Invite accepted',
      accepter_name || ' accepted your invite to "' || project_name || '"',
      '/dashboard/projects/' || NEW.project_id,
      jsonb_build_object('project_id', NEW.project_id, 'user_id', NEW.shared_with_user_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 11. notify_project_collaborators()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_project_collaborators()
RETURNS TRIGGER AS $$
DECLARE
  project_record RECORD;
  collaborator RECORD;
  actor_name TEXT;
  action_text TEXT;
BEGIN
  SELECT id, name, created_by, organization_id INTO project_record
  FROM public.projects WHERE id = NEW.project_id;

  SELECT COALESCE(full_name, email) INTO actor_name
  FROM public.profiles WHERE id = NEW.user_id;

  IF actor_name IS NULL THEN
    actor_name := NEW.user_email;
  END IF;

  action_text := CASE NEW.action
    WHEN 'file_uploaded' THEN 'uploaded a file'
    WHEN 'file_deleted' THEN 'deleted a file'
    WHEN 'file_parsed' THEN 'parsed a file'
    WHEN 'project_shared' THEN 'shared the project'
    WHEN 'share_accepted' THEN 'joined the project'
    ELSE 'made changes'
  END;

  IF NEW.target_name IS NOT NULL AND NEW.action IN ('file_uploaded', 'file_deleted', 'file_parsed') THEN
    action_text := action_text || ' "' || NEW.target_name || '"';
  END IF;

  IF project_record.created_by IS NOT NULL AND project_record.created_by != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      project_record.created_by,
      'project_activity',
      'Activity in ' || project_record.name,
      actor_name || ' ' || action_text,
      '/dashboard/projects/' || NEW.project_id,
      jsonb_build_object(
        'project_id', NEW.project_id,
        'activity_id', NEW.id,
        'action', NEW.action
      )
    );
  END IF;

  FOR collaborator IN
    SELECT DISTINCT ps.shared_with_user_id as user_id
    FROM public.project_shares ps
    WHERE ps.project_id = NEW.project_id
      AND ps.accepted_at IS NOT NULL
      AND ps.shared_with_user_id IS NOT NULL
      AND ps.shared_with_user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      collaborator.user_id,
      'project_activity',
      'Activity in ' || project_record.name,
      actor_name || ' ' || action_text,
      '/dashboard/projects/' || NEW.project_id,
      jsonb_build_object(
        'project_id', NEW.project_id,
        'activity_id', NEW.id,
        'action', NEW.action
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 12. create_default_naming_rules()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_default_naming_rules()
RETURNS TRIGGER AS $$
DECLARE
  new_set_id UUID;
BEGIN
  INSERT INTO public.naming_rule_sets (organization_id, name, is_default)
  VALUES (NEW.id, 'Default', true)
  RETURNING id INTO new_set_id;

  INSERT INTO public.naming_rules (organization_id, rule_set_id, name, description, pattern, applies_to, severity) VALUES
    (NEW.id, new_set_id, 'No Spaces in Names', 'Tag names should not contain spaces', '^[^\s]+$', 'all', 'error'),
    (NEW.id, new_set_id, 'Start with Letter', 'Tag names should start with a letter', '^[A-Za-z]', 'all', 'warning'),
    (NEW.id, new_set_id, 'Underscore Separator', 'Use underscores to separate words (no camelCase)', '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$', 'all', 'info');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 13. cleanup_expired_ai_cache()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_ai_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.ai_analysis_cache
  WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
