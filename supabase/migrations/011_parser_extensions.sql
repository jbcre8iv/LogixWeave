-- Migration: Parser Extensions for Rungs, UDTs, AOIs, and Tag References
-- Adds tables for detailed ladder logic parsing, User Defined Types, Add-On Instructions,
-- and tag cross-reference tracking

-- Create parsed_rungs table
CREATE TABLE parsed_rungs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES parsed_routines(id) ON DELETE SET NULL,
  routine_name TEXT NOT NULL,
  program_name TEXT NOT NULL,
  number INTEGER NOT NULL,
  content TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create tag_references table for cross-reference tracking
CREATE TABLE tag_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  routine_name TEXT NOT NULL,
  program_name TEXT NOT NULL,
  rung_number INTEGER NOT NULL,
  usage_type TEXT NOT NULL CHECK (usage_type IN ('read', 'write', 'both')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create parsed_udts table for User Defined Types
CREATE TABLE parsed_udts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  family_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create parsed_udt_members table for UDT member definitions
CREATE TABLE parsed_udt_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  udt_id UUID NOT NULL REFERENCES parsed_udts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  dimension TEXT,
  radix TEXT,
  external_access TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create parsed_aois table for Add-On Instructions
CREATE TABLE parsed_aois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  revision TEXT,
  vendor TEXT,
  execute_prescan BOOLEAN DEFAULT false,
  execute_postscan BOOLEAN DEFAULT false,
  execute_enable_in_false BOOLEAN DEFAULT false,
  created_date TEXT,
  created_by TEXT,
  edited_date TEXT,
  edited_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create parsed_aoi_parameters table for AOI parameter definitions
CREATE TABLE parsed_aoi_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aoi_id UUID NOT NULL REFERENCES parsed_aois(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  usage TEXT NOT NULL CHECK (usage IN ('Input', 'Output', 'InOut')),
  required BOOLEAN DEFAULT false,
  visible BOOLEAN DEFAULT true,
  external_access TEXT,
  description TEXT,
  default_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create parsed_aoi_local_tags table for AOI local tag definitions
CREATE TABLE parsed_aoi_local_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aoi_id UUID NOT NULL REFERENCES parsed_aois(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  radix TEXT,
  external_access TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create parsed_aoi_routines table for AOI routine definitions
CREATE TABLE parsed_aoi_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aoi_id UUID NOT NULL REFERENCES parsed_aois(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  rung_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_parsed_rungs_file_id ON parsed_rungs(file_id);
CREATE INDEX idx_parsed_rungs_routine_name ON parsed_rungs(routine_name);
CREATE INDEX idx_parsed_rungs_program_name ON parsed_rungs(program_name);

CREATE INDEX idx_tag_references_file_id ON tag_references(file_id);
CREATE INDEX idx_tag_references_tag_name ON tag_references(tag_name);
CREATE INDEX idx_tag_references_routine_name ON tag_references(routine_name);
CREATE INDEX idx_tag_references_usage_type ON tag_references(usage_type);

CREATE INDEX idx_parsed_udts_file_id ON parsed_udts(file_id);
CREATE INDEX idx_parsed_udts_name ON parsed_udts(name);
CREATE INDEX idx_parsed_udt_members_udt_id ON parsed_udt_members(udt_id);

CREATE INDEX idx_parsed_aois_file_id ON parsed_aois(file_id);
CREATE INDEX idx_parsed_aois_name ON parsed_aois(name);
CREATE INDEX idx_parsed_aoi_parameters_aoi_id ON parsed_aoi_parameters(aoi_id);
CREATE INDEX idx_parsed_aoi_local_tags_aoi_id ON parsed_aoi_local_tags(aoi_id);
CREATE INDEX idx_parsed_aoi_routines_aoi_id ON parsed_aoi_routines(aoi_id);

-- Enable Row Level Security
ALTER TABLE parsed_rungs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_udts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_udt_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_aois ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_aoi_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_aoi_local_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_aoi_routines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parsed_rungs
CREATE POLICY "Users can view rungs from files in their org projects"
  ON parsed_rungs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE pf.id = parsed_rungs.file_id
      AND om.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE pf.id = parsed_rungs.file_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Service role can insert rungs"
  ON parsed_rungs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete rungs"
  ON parsed_rungs FOR DELETE
  USING (true);

-- RLS Policies for tag_references
CREATE POLICY "Users can view tag references from files in their org projects"
  ON tag_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE pf.id = tag_references.file_id
      AND om.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE pf.id = tag_references.file_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Service role can insert tag references"
  ON tag_references FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete tag references"
  ON tag_references FOR DELETE
  USING (true);

-- RLS Policies for parsed_udts
CREATE POLICY "Users can view UDTs from files in their org projects"
  ON parsed_udts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE pf.id = parsed_udts.file_id
      AND om.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE pf.id = parsed_udts.file_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Service role can insert UDTs"
  ON parsed_udts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete UDTs"
  ON parsed_udts FOR DELETE
  USING (true);

-- RLS Policies for parsed_udt_members
CREATE POLICY "Users can view UDT members from UDTs they can access"
  ON parsed_udt_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parsed_udts udt
      JOIN project_files pf ON udt.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE udt.id = parsed_udt_members.udt_id
      AND om.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM parsed_udts udt
      JOIN project_files pf ON udt.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE udt.id = parsed_udt_members.udt_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Service role can insert UDT members"
  ON parsed_udt_members FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete UDT members"
  ON parsed_udt_members FOR DELETE
  USING (true);

-- RLS Policies for parsed_aois
CREATE POLICY "Users can view AOIs from files in their org projects"
  ON parsed_aois FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE pf.id = parsed_aois.file_id
      AND om.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON pf.project_id = p.id
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE pf.id = parsed_aois.file_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Service role can insert AOIs"
  ON parsed_aois FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete AOIs"
  ON parsed_aois FOR DELETE
  USING (true);

-- RLS Policies for parsed_aoi_parameters
CREATE POLICY "Users can view AOI parameters from AOIs they can access"
  ON parsed_aoi_parameters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE aoi.id = parsed_aoi_parameters.aoi_id
      AND om.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE aoi.id = parsed_aoi_parameters.aoi_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Service role can insert AOI parameters"
  ON parsed_aoi_parameters FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete AOI parameters"
  ON parsed_aoi_parameters FOR DELETE
  USING (true);

-- RLS Policies for parsed_aoi_local_tags
CREATE POLICY "Users can view AOI local tags from AOIs they can access"
  ON parsed_aoi_local_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE aoi.id = parsed_aoi_local_tags.aoi_id
      AND om.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE aoi.id = parsed_aoi_local_tags.aoi_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Service role can insert AOI local tags"
  ON parsed_aoi_local_tags FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete AOI local tags"
  ON parsed_aoi_local_tags FOR DELETE
  USING (true);

-- RLS Policies for parsed_aoi_routines
CREATE POLICY "Users can view AOI routines from AOIs they can access"
  ON parsed_aoi_routines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN organization_members om ON p.organization_id = om.organization_id
      WHERE aoi.id = parsed_aoi_routines.aoi_id
      AND om.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM parsed_aois aoi
      JOIN project_files pf ON aoi.file_id = pf.id
      JOIN projects p ON pf.project_id = p.id
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE aoi.id = parsed_aoi_routines.aoi_id
      AND ps.shared_with_user_id = auth.uid()
      AND ps.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Service role can insert AOI routines"
  ON parsed_aoi_routines FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete AOI routines"
  ON parsed_aoi_routines FOR DELETE
  USING (true);
