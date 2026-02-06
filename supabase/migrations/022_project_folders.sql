-- Migration: Project Folders
-- Allows users to organize files into folders within projects

-- Create project_folders table
CREATE TABLE project_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Add folder_id to project_files (nullable - files can be at root level)
ALTER TABLE project_files
ADD COLUMN folder_id UUID REFERENCES project_folders(id) ON DELETE SET NULL;

-- Index for faster folder queries
CREATE INDEX idx_project_folders_project_id ON project_folders(project_id);
CREATE INDEX idx_project_files_folder_id ON project_files(folder_id);

-- Enable RLS
ALTER TABLE project_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_folders (same access as projects)
CREATE POLICY "Users can view folders in their organization's projects"
  ON project_folders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = project_folders.project_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create folders in their organization's projects"
  ON project_folders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = project_folders.project_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update folders in their organization's projects"
  ON project_folders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = project_folders.project_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete folders in their organization's projects"
  ON project_folders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = project_folders.project_id
      AND om.user_id = auth.uid()
    )
  );
