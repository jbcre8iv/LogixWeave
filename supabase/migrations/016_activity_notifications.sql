-- Migration: Activity Notifications
-- Add notification type for project activity and create notifications for collaborators

-- Add new type to notifications check constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('project_shared', 'project_updated', 'share_accepted', 'general', 'project_activity'));

-- Function to notify collaborators of project activity
CREATE OR REPLACE FUNCTION notify_project_collaborators()
RETURNS TRIGGER AS $$
DECLARE
  project_record RECORD;
  collaborator RECORD;
  actor_name TEXT;
  action_text TEXT;
BEGIN
  -- Get project info
  SELECT id, name, created_by, organization_id INTO project_record
  FROM projects WHERE id = NEW.project_id;

  -- Get the actor's name
  SELECT COALESCE(full_name, email) INTO actor_name
  FROM profiles WHERE id = NEW.user_id;

  IF actor_name IS NULL THEN
    actor_name := NEW.user_email;
  END IF;

  -- Determine action text based on action type
  action_text := CASE NEW.action
    WHEN 'file_uploaded' THEN 'uploaded a file'
    WHEN 'file_deleted' THEN 'deleted a file'
    WHEN 'file_parsed' THEN 'parsed a file'
    WHEN 'project_shared' THEN 'shared the project'
    WHEN 'share_accepted' THEN 'joined the project'
    ELSE 'made changes'
  END;

  -- Add target name if available
  IF NEW.target_name IS NOT NULL AND NEW.action IN ('file_uploaded', 'file_deleted', 'file_parsed') THEN
    action_text := action_text || ' "' || NEW.target_name || '"';
  END IF;

  -- Notify project owner (if not the actor)
  IF project_record.created_by IS NOT NULL AND project_record.created_by != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
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
    FROM project_shares ps
    WHERE ps.project_id = NEW.project_id
      AND ps.accepted_at IS NOT NULL
      AND ps.shared_with_user_id IS NOT NULL
      AND ps.shared_with_user_id != NEW.user_id
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to notify on significant activity
DROP TRIGGER IF EXISTS on_project_activity_notify ON project_activity_log;
CREATE TRIGGER on_project_activity_notify
  AFTER INSERT ON project_activity_log
  FOR EACH ROW
  WHEN (NEW.action IN ('file_uploaded', 'file_deleted', 'file_parsed', 'share_accepted'))
  EXECUTE FUNCTION notify_project_collaborators();
