-- Permission requests table
CREATE TABLE IF NOT EXISTS permission_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_permission TEXT NOT NULL CHECK (current_permission IN ('view', 'edit')),
  requested_permission TEXT NOT NULL CHECK (requested_permission IN ('edit', 'owner')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, requester_id, status) -- Only one pending request per user per project
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_permission_requests_project ON permission_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_requester ON permission_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_pending ON permission_requests(project_id) WHERE status = 'pending';

-- RLS
ALTER TABLE permission_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own permission requests"
  ON permission_requests FOR SELECT
  USING (requester_id = auth.uid());

-- Project owners can view all requests for their projects
CREATE POLICY "Owners can view project permission requests"
  ON permission_requests FOR SELECT
  USING (user_is_project_owner(project_id));

-- Users can create requests for projects they have access to
CREATE POLICY "Users can create permission requests"
  ON permission_requests FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM project_shares
      WHERE project_id = permission_requests.project_id
      AND (shared_with_user_id = auth.uid() OR shared_with_email = auth.jwt() ->> 'email')
    )
  );

-- Only owners can update requests (approve/reject)
CREATE POLICY "Owners can update permission requests"
  ON permission_requests FOR UPDATE
  USING (user_is_project_owner(project_id));

-- Function to create notification when permission is requested
CREATE OR REPLACE FUNCTION notify_on_permission_request()
RETURNS TRIGGER AS $$
DECLARE
  project_name TEXT;
  requester_name TEXT;
  owner_id UUID;
BEGIN
  -- Get project info
  SELECT name, created_by INTO project_name, owner_id FROM projects WHERE id = NEW.project_id;

  -- Get requester name
  SELECT COALESCE(full_name, email) INTO requester_name
  FROM profiles WHERE id = NEW.requester_id;

  -- Create notification for project owner
  INSERT INTO notifications (user_id, type, title, message, link, metadata)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for permission request notifications
DROP TRIGGER IF EXISTS on_permission_request_notify ON permission_requests;
CREATE TRIGGER on_permission_request_notify
  AFTER INSERT ON permission_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_permission_request();

-- Function to notify requester when request is reviewed
CREATE OR REPLACE FUNCTION notify_on_permission_review()
RETURNS TRIGGER AS $$
DECLARE
  project_name TEXT;
BEGIN
  -- Only notify on status change
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT name INTO project_name FROM projects WHERE id = NEW.project_id;

    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      NEW.requester_id,
      'general',
      'Permission request ' || NEW.status,
      'Your request for ' || NEW.requested_permission || ' access to "' || project_name || '" was ' || NEW.status,
      '/dashboard/projects/' || NEW.project_id,
      jsonb_build_object('request_id', NEW.id, 'status', NEW.status)
    );

    -- If approved, update the share permission
    IF NEW.status = 'approved' THEN
      UPDATE project_shares
      SET permission = NEW.requested_permission
      WHERE project_id = NEW.project_id
      AND (shared_with_user_id = NEW.requester_id OR shared_with_email = (SELECT email FROM profiles WHERE id = NEW.requester_id));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for permission review notifications
DROP TRIGGER IF EXISTS on_permission_review_notify ON permission_requests;
CREATE TRIGGER on_permission_review_notify
  AFTER UPDATE ON permission_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_permission_review();
