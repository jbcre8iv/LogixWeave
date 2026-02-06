-- Migration: Separate first name and last name
-- Add first_name and last_name columns to profiles table

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

COMMENT ON COLUMN profiles.first_name IS 'User first name';
COMMENT ON COLUMN profiles.last_name IS 'User last name';

-- Migrate existing full_name data to first_name and last_name
-- This splits on the first space, putting everything before in first_name
-- and everything after in last_name
UPDATE profiles
SET
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE
    WHEN POSITION(' ' IN full_name) > 0
    THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE NULL
  END
WHERE full_name IS NOT NULL
  AND first_name IS NULL;
