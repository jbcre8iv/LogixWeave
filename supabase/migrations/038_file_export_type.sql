-- Add export type metadata to project_files
-- Stores the L5X TargetType (Controller, Routine, Program, etc.) and TargetName
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS target_name TEXT;
