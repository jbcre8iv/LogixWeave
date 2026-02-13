-- Migration: Security Events Table
-- Immutable log for security-related events (auth failures, rate limits, attacks)

CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ip_address TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_ip_address ON security_events(ip_address);

-- Enable Row Level Security
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read security events
CREATE POLICY "Platform admins can view security events"
  ON security_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_platform_admin = true
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated users
-- Service role (used by the monitor) bypasses RLS
-- This makes the log immutable from the client side

COMMENT ON TABLE security_events IS 'Immutable security event log. Service-role inserts only, admin-only reads.';
