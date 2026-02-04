-- Add is_favorite column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster favorite queries
CREATE INDEX IF NOT EXISTS idx_projects_is_favorite ON projects(is_favorite) WHERE is_favorite = true;
