-- Fix user_profiles view to respect RLS from underlying users table
-- Views by default run as the view owner (postgres), bypassing RLS.
-- Setting security_invoker = true makes the view run with the caller's permissions.

ALTER VIEW public.user_profiles SET (security_invoker = true);
