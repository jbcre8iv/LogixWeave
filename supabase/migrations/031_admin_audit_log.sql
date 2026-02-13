-- Migration: Admin Audit Log
-- Immutable record of all admin actions for compliance

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  target_email TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for querying
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);

-- Enable Row Level Security
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read audit logs
CREATE POLICY "Platform admins can view audit logs"
  ON admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_platform_admin = true
    )
  );

-- No INSERT/UPDATE/DELETE policies — service-role only
-- This makes the log immutable from the client side

COMMENT ON TABLE admin_audit_log IS 'Immutable audit log for admin actions. Service-role inserts only.';
