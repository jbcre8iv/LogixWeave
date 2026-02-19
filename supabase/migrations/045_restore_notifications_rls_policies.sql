-- Migration: Restore missing RLS policies on notifications table
-- RLS is enabled (migration 033) but all policies were dropped at some point,
-- blocking all reads/writes for the authenticated role. The SECURITY DEFINER
-- trigger could still INSERT, but users couldn't SELECT their own notifications.

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Allow inserts from authenticated users (needed for direct notification inserts
-- like share_revoked in the shares API route)
CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
