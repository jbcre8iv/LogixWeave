-- Add archive support to projects (soft delete)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Partial index for efficient filtering of archived projects
CREATE INDEX IF NOT EXISTS idx_projects_is_archived ON projects(is_archived) WHERE is_archived = true;
