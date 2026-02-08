-- Migration: Naming Rule Sets
-- Adds named rule sets that can be assigned per-project, with org-level defaults.

-- 1. Create naming_rule_sets table
CREATE TABLE naming_rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only one default per org
CREATE UNIQUE INDEX idx_naming_rule_sets_one_default
  ON naming_rule_sets (organization_id) WHERE (is_default = true);

-- No duplicate names within an org
CREATE UNIQUE INDEX idx_naming_rule_sets_org_name
  ON naming_rule_sets (organization_id, name);

CREATE INDEX idx_naming_rule_sets_org_id
  ON naming_rule_sets (organization_id);

-- updated_at trigger
CREATE TRIGGER update_naming_rule_sets_updated_at
  BEFORE UPDATE ON naming_rule_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE naming_rule_sets ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as naming_rules)
CREATE POLICY "Users can view naming rule sets in their organization"
  ON naming_rule_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = naming_rule_sets.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and owners can insert naming rule sets"
  ON naming_rule_sets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = naming_rule_sets.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can update naming rule sets"
  ON naming_rule_sets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = naming_rule_sets.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can delete naming rule sets"
  ON naming_rule_sets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = naming_rule_sets.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- 2. Add rule_set_id to naming_rules (nullable initially for backfill)
ALTER TABLE naming_rules ADD COLUMN rule_set_id UUID REFERENCES naming_rule_sets(id) ON DELETE CASCADE;

-- 3. Add naming_rule_set_id to projects (nullable — null means use org default)
ALTER TABLE projects ADD COLUMN naming_rule_set_id UUID REFERENCES naming_rule_sets(id) ON DELETE SET NULL;

-- 4. Data migration: create a "Default" rule set per org and point existing rules to it
DO $$
DECLARE
  org RECORD;
  new_set_id UUID;
BEGIN
  FOR org IN SELECT DISTINCT organization_id FROM naming_rules LOOP
    INSERT INTO naming_rule_sets (organization_id, name, is_default)
    VALUES (org.organization_id, 'Default', true)
    RETURNING id INTO new_set_id;

    UPDATE naming_rules
    SET rule_set_id = new_set_id
    WHERE organization_id = org.organization_id;
  END LOOP;

  -- Also create default sets for orgs that have no naming rules yet
  FOR org IN
    SELECT id FROM organizations
    WHERE id NOT IN (SELECT DISTINCT organization_id FROM naming_rule_sets)
  LOOP
    INSERT INTO naming_rule_sets (organization_id, name, is_default)
    VALUES (org.id, 'Default', true);
  END LOOP;
END $$;

-- 5. Make rule_set_id NOT NULL now that all rows are backfilled
ALTER TABLE naming_rules ALTER COLUMN rule_set_id SET NOT NULL;

-- Index for rule_set_id queries
CREATE INDEX idx_naming_rules_rule_set_id ON naming_rules(rule_set_id);

-- 6. Update the trigger that creates default rules for new orgs
CREATE OR REPLACE FUNCTION create_default_naming_rules()
RETURNS TRIGGER AS $$
DECLARE
  new_set_id UUID;
BEGIN
  -- Create a default rule set for the new org
  INSERT INTO naming_rule_sets (organization_id, name, is_default)
  VALUES (NEW.id, 'Default', true)
  RETURNING id INTO new_set_id;

  -- Insert default rules into that set
  INSERT INTO naming_rules (organization_id, rule_set_id, name, description, pattern, applies_to, severity) VALUES
    (NEW.id, new_set_id, 'No Spaces in Names', 'Tag names should not contain spaces', '^[^\s]+$', 'all', 'error'),
    (NEW.id, new_set_id, 'Start with Letter', 'Tag names should start with a letter', '^[A-Za-z]', 'all', 'warning'),
    (NEW.id, new_set_id, 'Underscore Separator', 'Use underscores to separate words (no camelCase)', '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$', 'all', 'info');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
