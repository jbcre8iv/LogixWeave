-- Migration: Link parsed data to file versions
-- This enables comparing different versions of the same file

-- Add version_id to parsed data tables (nullable for backwards compatibility)
ALTER TABLE parsed_tags
ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES file_versions(id) ON DELETE CASCADE;

ALTER TABLE parsed_routines
ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES file_versions(id) ON DELETE CASCADE;

ALTER TABLE parsed_io_modules
ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES file_versions(id) ON DELETE CASCADE;

ALTER TABLE parsed_rungs
ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES file_versions(id) ON DELETE CASCADE;

ALTER TABLE parsed_udts
ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES file_versions(id) ON DELETE CASCADE;

ALTER TABLE parsed_aois
ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES file_versions(id) ON DELETE CASCADE;

-- Create indexes for version-based queries
CREATE INDEX IF NOT EXISTS idx_parsed_tags_version_id ON parsed_tags(version_id);
CREATE INDEX IF NOT EXISTS idx_parsed_routines_version_id ON parsed_routines(version_id);
CREATE INDEX IF NOT EXISTS idx_parsed_io_modules_version_id ON parsed_io_modules(version_id);
CREATE INDEX IF NOT EXISTS idx_parsed_rungs_version_id ON parsed_rungs(version_id);
CREATE INDEX IF NOT EXISTS idx_parsed_udts_version_id ON parsed_udts(version_id);
CREATE INDEX IF NOT EXISTS idx_parsed_aois_version_id ON parsed_aois(version_id);

-- Add comment explaining the versioning relationship
COMMENT ON COLUMN parsed_tags.version_id IS 'Links to specific file version for version comparison. Null for legacy data.';
COMMENT ON COLUMN parsed_routines.version_id IS 'Links to specific file version for version comparison. Null for legacy data.';
COMMENT ON COLUMN parsed_io_modules.version_id IS 'Links to specific file version for version comparison. Null for legacy data.';
