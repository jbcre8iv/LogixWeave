-- Migration: Re-enable RLS on notifications table
-- Supabase Security Advisor flagged this as disabled.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
