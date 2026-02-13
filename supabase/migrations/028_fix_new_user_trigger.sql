-- Update handle_new_user() trigger to populate first_name and last_name
-- These columns were added in migration 025 but the trigger was never updated

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, first_name, last_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing profiles that have full_name but missing first_name/last_name
UPDATE profiles
SET
    first_name = COALESCE(
        first_name,
        (SELECT raw_user_meta_data->>'first_name' FROM auth.users WHERE auth.users.id = profiles.id)
    ),
    last_name = COALESCE(
        last_name,
        (SELECT raw_user_meta_data->>'last_name' FROM auth.users WHERE auth.users.id = profiles.id)
    )
WHERE first_name IS NULL OR last_name IS NULL;
