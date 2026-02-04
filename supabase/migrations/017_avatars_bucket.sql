-- Migration: Create avatars storage bucket
-- Note: This SQL needs to be run, but storage bucket creation is typically done via Supabase dashboard
-- or via the Supabase CLI. This file documents the required configuration.

-- The avatars bucket should be created with the following settings:
-- - Bucket name: avatars
-- - Public: true (so avatar URLs can be accessed without authentication)
-- - File size limit: 2MB
-- - Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- Storage policies for the avatars bucket:
-- These can be configured in the Supabase dashboard under Storage > Policies

-- Policy: Allow authenticated users to upload their own avatar
-- Operation: INSERT
-- Policy: (bucket_id = 'avatars') AND (auth.uid()::text = (storage.foldername(name))[1])

-- Policy: Allow authenticated users to update their own avatar
-- Operation: UPDATE
-- Policy: (bucket_id = 'avatars') AND (auth.uid()::text = (storage.foldername(name))[1])

-- Policy: Allow authenticated users to delete their own avatar
-- Operation: DELETE
-- Policy: (bucket_id = 'avatars') AND (auth.uid()::text = (storage.foldername(name))[1])

-- Policy: Allow public read access to all avatars
-- Operation: SELECT
-- Policy: bucket_id = 'avatars'

-- Note: Since we're storing files as {user_id}-{timestamp}.{ext}, the policies above
-- use the filename prefix to verify ownership.

-- Alternative simpler policies that allow any authenticated user to manage files:

-- For INSERT (upload):
-- CREATE POLICY "Authenticated users can upload avatars"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- For SELECT (read/download):
-- CREATE POLICY "Anyone can view avatars"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'avatars');

-- For DELETE:
-- CREATE POLICY "Users can delete their own avatars"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'avatars' AND auth.uid()::text = SPLIT_PART(name, '-', 1));
