-- Fix Supabase linter warnings: mutable search_path + permissive RLS policy
-- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- 1. Set immutable search_path on all flagged functions

ALTER FUNCTION public.update_last_seen(uuid) SET search_path = '';
ALTER FUNCTION public.get_ranking_by_activity_type(text, integer) SET search_path = '';
ALTER FUNCTION public.get_system_stats() SET search_path = '';
ALTER FUNCTION public.add_user_score(uuid, text, integer, text) SET search_path = '';
ALTER FUNCTION public.get_ranking(integer) SET search_path = '';
ALTER FUNCTION public.get_gamification_stats() SET search_path = '';
ALTER FUNCTION public.get_total_xp() SET search_path = '';
ALTER FUNCTION public.get_ranking_by_class(uuid, integer) SET search_path = '';
ALTER FUNCTION public.get_user_score_history(uuid, integer) SET search_path = '';
ALTER FUNCTION public.get_import_stats() SET search_path = '';
ALTER FUNCTION public.handle_updated_at() SET search_path = '';

-- 2. Fix permissive RLS policy on invite_registrations
-- Replace WITH CHECK (true) with a check that the invite exists and is active,
-- and that the user is authenticated and can only register themselves

DROP POLICY IF EXISTS "Public register for invite" ON public.invite_registrations;

CREATE POLICY "Public register for invite"
  ON public.invite_registrations FOR INSERT
  WITH CHECK (
    -- User can only register themselves
    user_id = auth.uid()
    AND
    -- Invite must exist and be active
    EXISTS (
      SELECT 1 FROM public.invites
      WHERE invites.id = invite_id
        AND invites.status = 'active'
    )
  );
