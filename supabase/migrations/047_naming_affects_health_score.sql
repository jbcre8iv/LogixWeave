-- Add per-project toggle for including naming compliance in health score
ALTER TABLE projects ADD COLUMN IF NOT EXISTS naming_affects_health_score BOOLEAN NOT NULL DEFAULT true;
