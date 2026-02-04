-- Migration: Naming Rules for Tag Naming Convention Validation
-- Adds tables for organization-specific naming rules

-- Create naming_rules table
CREATE TABLE naming_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  pattern TEXT NOT NULL,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('all', 'controller', 'program', 'io', 'udt', 'aoi')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('error', 'warning', 'info')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for organization queries
CREATE INDEX idx_naming_rules_org_id ON naming_rules(organization_id);
CREATE INDEX idx_naming_rules_active ON naming_rules(organization_id, is_active);

-- Add updated_at trigger
CREATE TRIGGER update_naming_rules_updated_at
  BEFORE UPDATE ON naming_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE naming_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for naming_rules
CREATE POLICY "Users can view naming rules in their organization"
  ON naming_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = naming_rules.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and owners can insert naming rules"
  ON naming_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = naming_rules.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can update naming rules"
  ON naming_rules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = naming_rules.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can delete naming rules"
  ON naming_rules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = naming_rules.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Insert default naming rules for new organizations (via trigger)
CREATE OR REPLACE FUNCTION create_default_naming_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert some common industrial naming convention rules
  INSERT INTO naming_rules (organization_id, name, description, pattern, applies_to, severity) VALUES
    (NEW.id, 'No Spaces in Names', 'Tag names should not contain spaces', '^[^\s]+$', 'all', 'error'),
    (NEW.id, 'Start with Letter', 'Tag names should start with a letter', '^[A-Za-z]', 'all', 'warning'),
    (NEW.id, 'Underscore Separator', 'Use underscores to separate words (no camelCase)', '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$', 'all', 'info');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_default_naming_rules_trigger
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_naming_rules();
