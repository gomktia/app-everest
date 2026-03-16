-- Fix overly permissive RLS policies on invites and class_content_access

-- 1. Fix invites: only admins/teachers can manage (not all authenticated users)
DROP POLICY IF EXISTS "Authenticated manage invites" ON public.invites;

CREATE POLICY "Staff manage invites"
  ON public.invites FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('administrator', 'teacher'))
  );

-- 2. Fix class_content_access: students can only SELECT their own class entries
DROP POLICY IF EXISTS "Authenticated manage content access" ON public.class_content_access;

-- Admins/teachers can manage all content access
CREATE POLICY "Staff manage content access"
  ON public.class_content_access FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('administrator', 'teacher'))
  );

-- Students can only read content access for their enrolled classes
CREATE POLICY "Students read own class content access"
  ON public.class_content_access FOR SELECT TO authenticated
  USING (
    class_id IN (SELECT class_id FROM public.student_classes WHERE user_id = auth.uid())
  );
