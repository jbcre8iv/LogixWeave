-- Migration: Fix duplicate share_accepted notification for project owner
-- and add project_updated to the trigger WHEN clause.
--
-- Problem: When a user accepts an invite, the owner gets TWO notifications:
--   1. "share_accepted" from on_invite_accepted_notify (on project_shares UPDATE)
--   2. "project_activity" from on_project_activity_notify (on activity log INSERT)
-- Fix: Skip the owner in notify_project_collaborators() for share_accepted,
--      since the dedicated trigger already handles the owner.

CREATE OR REPLACE FUNCTION public.notify_project_collaborators()
RETURNS TRIGGER AS $$
DECLARE
  project_record RECORD;
  collaborator RECORD;
  actor_name TEXT;
  action_text TEXT;
BEGIN
  -- Get project info
  SELECT id, name, created_by, organization_id INTO project_record
  FROM public.projects WHERE id = NEW.project_id;

  -- Get the actor's name
  SELECT COALESCE(full_name, email) INTO actor_name
  FROM public.profiles WHERE id = NEW.user_id;

  IF actor_name IS NULL THEN
    actor_name := NEW.user_email;
  END IF;

  -- Determine action text based on action type
  action_text := CASE NEW.action
    WHEN 'file_uploaded' THEN 'uploaded a file'
    WHEN 'file_deleted' THEN 'deleted a file'
    WHEN 'file_parsed' THEN 'parsed a file'
    WHEN 'file_parse_failed' THEN 'encountered a parse error on'
    WHEN 'project_shared' THEN 'shared the project'
    WHEN 'share_accepted' THEN 'joined the project'
    WHEN 'share_revoked' THEN 'revoked access for'
    WHEN 'permission_changed' THEN 'updated permissions for'
    WHEN 'member_left' THEN 'left the project'
    WHEN 'project_updated' THEN 'updated project settings'
    ELSE 'made changes'
  END;

  -- Append target name for relevant actions
  IF NEW.target_name IS NOT NULL AND NEW.action IN (
    'file_uploaded', 'file_deleted', 'file_parsed',
    'file_parse_failed', 'share_revoked', 'permission_changed'
  ) THEN
    action_text := action_text || ' "' || NEW.target_name || '"';
  END IF;

  -- Notify project owner (if not the actor)
  -- Skip for share_accepted: the dedicated on_invite_accepted_notify trigger
  -- already sends the owner a more specific "share_accepted" notification.
  IF project_record.created_by IS NOT NULL
     AND project_record.created_by != NEW.user_id
     AND NEW.action != 'share_accepted'
  THEN
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

  -- Notify all collaborators with accepted shares (except the actor)
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

-- Recreate trigger with project_updated added to the WHEN clause
DROP TRIGGER IF EXISTS on_project_activity_notify ON project_activity_log;
CREATE TRIGGER on_project_activity_notify
  AFTER INSERT ON project_activity_log
  FOR EACH ROW
  WHEN (NEW.action IN (
    'file_uploaded', 'file_deleted', 'file_parsed', 'share_accepted',
    'share_revoked', 'file_parse_failed', 'permission_changed',
    'member_left', 'project_updated'
  ))
  EXECUTE FUNCTION public.notify_project_collaborators();
