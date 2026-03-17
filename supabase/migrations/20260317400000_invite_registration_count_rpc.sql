-- RPC to count invite registrations without RLS restriction
-- Needed because the invite page is public (user not authenticated yet)
CREATE OR REPLACE FUNCTION get_invite_registration_count(p_invite_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM public.invite_registrations
  WHERE invite_id = p_invite_id;
$$;
