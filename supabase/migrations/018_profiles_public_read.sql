-- Migration: Allow authenticated users to view other profiles
-- This enables displaying project owner info, collaborator names, etc.

-- Add policy to allow authenticated users to view basic profile info
CREATE POLICY "Authenticated users can view profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (true);

-- Note: The existing "Users can view their own profile" policy can remain,
-- but this new policy is more permissive and will take precedence for SELECT.
