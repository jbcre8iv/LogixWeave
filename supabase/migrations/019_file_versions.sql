-- Migration: File Version Control
-- Adds version tracking for project files, similar to Google Drive/OneDrive

-- Create file_versions table to track version history
CREATE TABLE file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_email TEXT,
  comment TEXT, -- Optional version comment/note
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure version numbers are unique per file
  UNIQUE(file_id, version_number)
);

-- Add version tracking columns to project_files
ALTER TABLE project_files
ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS version_count INTEGER DEFAULT 1;

-- Create indexes for efficient queries
CREATE INDEX idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX idx_file_versions_created_at ON file_versions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view versions for files they have access to
CREATE POLICY "Users can view versions for accessible files"
  ON file_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      WHERE pf.id = file_versions.file_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_shares ps
          WHERE ps.project_id = p.id
          AND (ps.shared_with_user_id = auth.uid() OR ps.shared_with_email = auth.jwt()->>'email')
          AND ps.accepted_at IS NOT NULL
        )
      )
    )
  );

-- Allow inserts for authenticated users (file upload will verify project access)
CREATE POLICY "Authenticated users can insert versions"
  ON file_versions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add comment explaining the versioning system
COMMENT ON TABLE file_versions IS 'Tracks version history for project files, enabling revision control similar to Google Drive';
COMMENT ON COLUMN file_versions.version_number IS 'Auto-incrementing version number per file (1, 2, 3, etc.)';
COMMENT ON COLUMN file_versions.storage_path IS 'Path to this specific version in Supabase storage';
COMMENT ON COLUMN project_files.current_version IS 'The currently active version number';
COMMENT ON COLUMN project_files.version_count IS 'Total number of versions for this file';
