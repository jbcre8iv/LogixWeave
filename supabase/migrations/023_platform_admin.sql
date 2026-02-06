-- Migration: Platform Admin Access
-- Allows designated platform administrators to access all user data for support/testing

-- Add is_platform_admin column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;

-- Set the platform admin (justin@jbcre8iv.com)
-- This will be set after the user signs up, or can be set manually
UPDATE profiles
SET is_platform_admin = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'justin@jbcre8iv.com'
);

-- Create a function to check if current user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_platform_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to allow platform admin access

-- Projects: Allow platform admin to view all
DROP POLICY IF EXISTS "Platform admins can view all projects" ON projects;
CREATE POLICY "Platform admins can view all projects"
  ON projects FOR SELECT
  USING (is_platform_admin());

-- Project files: Allow platform admin to view all
DROP POLICY IF EXISTS "Platform admins can view all project files" ON project_files;
CREATE POLICY "Platform admins can view all project files"
  ON project_files FOR SELECT
  USING (is_platform_admin());

-- Project folders: Allow platform admin to view all
DROP POLICY IF EXISTS "Platform admins can view all project folders" ON project_folders;
CREATE POLICY "Platform admins can view all project folders"
  ON project_folders FOR SELECT
  USING (is_platform_admin());

-- Parsed data tables: Allow platform admin to view all
DROP POLICY IF EXISTS "Platform admins can view all parsed tags" ON parsed_tags;
CREATE POLICY "Platform admins can view all parsed tags"
  ON parsed_tags FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view all parsed routines" ON parsed_routines;
CREATE POLICY "Platform admins can view all parsed routines"
  ON parsed_routines FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view all parsed io modules" ON parsed_io_modules;
CREATE POLICY "Platform admins can view all parsed io modules"
  ON parsed_io_modules FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view all parsed rungs" ON parsed_rungs;
CREATE POLICY "Platform admins can view all parsed rungs"
  ON parsed_rungs FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view all parsed udts" ON parsed_udts;
CREATE POLICY "Platform admins can view all parsed udts"
  ON parsed_udts FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view all parsed aois" ON parsed_aois;
CREATE POLICY "Platform admins can view all parsed aois"
  ON parsed_aois FOR SELECT
  USING (is_platform_admin());

-- Organizations: Allow platform admin to view all
DROP POLICY IF EXISTS "Platform admins can view all organizations" ON organizations;
CREATE POLICY "Platform admins can view all organizations"
  ON organizations FOR SELECT
  USING (is_platform_admin());

-- Organization members: Allow platform admin to view all
DROP POLICY IF EXISTS "Platform admins can view all organization members" ON organization_members;
CREATE POLICY "Platform admins can view all organization members"
  ON organization_members FOR SELECT
  USING (is_platform_admin());

-- Profiles: Allow platform admin to view all (for user listing)
DROP POLICY IF EXISTS "Platform admins can view all profiles" ON profiles;
CREATE POLICY "Platform admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_platform_admin());

-- File versions: Allow platform admin to view all
DROP POLICY IF EXISTS "Platform admins can view all file versions" ON file_versions;
CREATE POLICY "Platform admins can view all file versions"
  ON file_versions FOR SELECT
  USING (is_platform_admin());

-- Activity logs: Allow platform admin to view all
DROP POLICY IF EXISTS "Platform admins can view all activity logs" ON activity_logs;
CREATE POLICY "Platform admins can view all activity logs"
  ON activity_logs FOR SELECT
  USING (is_platform_admin());

-- Comment for documentation
COMMENT ON COLUMN profiles.is_platform_admin IS 'Grants full read access to all platform data for support and testing purposes';
