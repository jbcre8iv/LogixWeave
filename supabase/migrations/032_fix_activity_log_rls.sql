-- Migration: Remove permissive INSERT policy on project_activity_log
-- Activity logs are now inserted via service client (bypasses RLS).
-- The old policy allowed any authenticated user to insert logs for any project.

DROP POLICY IF EXISTS "Service role can insert activity logs" ON project_activity_log;
