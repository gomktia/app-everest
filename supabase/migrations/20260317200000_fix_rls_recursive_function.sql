-- FIX: get_auth_user_role() was causing recursive RLS evaluation
-- The function queries the users table, which triggers RLS, which calls
-- get_auth_user_role() again = infinite recursion = 8s timeout on every page load.
-- Fix: add SECURITY DEFINER so it bypasses RLS when checking the role.

CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$;
