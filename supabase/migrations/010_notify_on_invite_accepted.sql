-- Function to notify owner when invite is accepted
CREATE OR REPLACE FUNCTION notify_on_invite_accepted()
RETURNS TRIGGER AS $$
DECLARE
  project_name TEXT;
  project_owner_id UUID;
  accepter_name TEXT;
BEGIN
  -- Only trigger when accepted_at changes from null to a value
  IF OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
    -- Get project name and owner
    SELECT name, created_by INTO project_name, project_owner_id
    FROM projects WHERE id = NEW.project_id;

    -- Get accepter name
    SELECT COALESCE(full_name, email) INTO accepter_name
    FROM profiles WHERE id = NEW.shared_with_user_id;

    -- Create notification for project owner
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for invite acceptance
DROP TRIGGER IF EXISTS on_invite_accepted_notify ON project_shares;
CREATE TRIGGER on_invite_accepted_notify
  AFTER UPDATE ON project_shares
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_invite_accepted();
