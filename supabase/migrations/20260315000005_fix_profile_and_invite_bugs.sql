-- Fix profile (bio, avatar_url) and invite registration bugs

-- 1. Add missing columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies for avatars bucket
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- 4. Recreate user_profiles view with bio + avatar_url columns
-- Many RLS policies and RPCs reference user_profiles
DROP VIEW IF EXISTS public.user_profiles CASCADE;

CREATE VIEW public.user_profiles AS
  SELECT id, email, first_name, last_name, role, is_active, bio, avatar_url, created_at, updated_at
  FROM public.users;

-- Allow updates through the view
CREATE OR REPLACE RULE user_profiles_update AS
  ON UPDATE TO public.user_profiles
  DO INSTEAD
  UPDATE public.users
  SET
    first_name = NEW.first_name,
    last_name = NEW.last_name,
    bio = NEW.bio,
    avatar_url = NEW.avatar_url,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
