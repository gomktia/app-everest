-- Fix RLS recursion on video_courses: replace raw subquery with get_auth_user_role()
-- This matches the fix applied in 20260317200000 for other tables

DROP POLICY IF EXISTS "vc_staff_insert" ON public.video_courses;
CREATE POLICY "vc_staff_insert" ON public.video_courses FOR INSERT TO authenticated
  WITH CHECK (get_auth_user_role() IN ('administrator', 'teacher'));

DROP POLICY IF EXISTS "vc_staff_update" ON public.video_courses;
CREATE POLICY "vc_staff_update" ON public.video_courses FOR UPDATE TO authenticated
  USING (get_auth_user_role() IN ('administrator', 'teacher'))
  WITH CHECK (get_auth_user_role() IN ('administrator', 'teacher'));
