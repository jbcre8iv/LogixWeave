-- Migration: User Disabled Flag
-- Track disabled users in profiles table

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles.is_disabled IS 'Indicates if user account has been disabled by platform admin';
