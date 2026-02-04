-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('project_shared', 'project_updated', 'share_accepted', 'general')),
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- System/service can insert notifications (using service role)
-- For now, we'll allow authenticated users to create notifications for others
-- This is needed for the share notification feature
CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Function to create notification when project is shared
CREATE OR REPLACE FUNCTION notify_on_project_share()
RETURNS TRIGGER AS $$
DECLARE
  project_name TEXT;
  sharer_name TEXT;
  recipient_id UUID;
BEGIN
  -- Get project name
  SELECT name INTO project_name FROM projects WHERE id = NEW.project_id;

  -- Get sharer name
  SELECT COALESCE(full_name, email) INTO sharer_name
  FROM profiles WHERE id = NEW.invited_by;

  -- Try to get recipient user id from profiles by email
  SELECT id INTO recipient_id
  FROM profiles WHERE email = NEW.shared_with_email;

  -- If recipient exists, create notification
  IF recipient_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      recipient_id,
      'project_shared',
      'Project shared with you',
      sharer_name || ' shared "' || project_name || '" with you',
      '/dashboard/projects/' || NEW.project_id,
      jsonb_build_object('project_id', NEW.project_id, 'permission', NEW.permission)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notification on new share
DROP TRIGGER IF EXISTS on_project_share_notify ON project_shares;
CREATE TRIGGER on_project_share_notify
  AFTER INSERT ON project_shares
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_project_share();
