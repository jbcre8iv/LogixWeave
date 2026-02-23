-- Soft-delete / Trash system for projects
-- Adds deleted_at/deleted_by columns and a purge function for auto-cleanup

-- Add soft-delete columns
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL REFERENCES auth.users(id);

-- Partial index for efficient trash queries
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at
  ON projects (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Function to purge expired trash (projects deleted > 30 days ago)
-- Returns the number of projects purged.
CREATE OR REPLACE FUNCTION purge_expired_trash()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  purged_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM projects
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO purged_count FROM deleted;

  RETURN purged_count;
END;
$$;
