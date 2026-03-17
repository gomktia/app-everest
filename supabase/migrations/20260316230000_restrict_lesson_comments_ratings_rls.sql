-- ============================================================
-- Restrict lesson_comments and lesson_ratings SELECT to enrolled students
-- Admins/teachers can still see everything.
-- Students can only see comments/ratings for lessons in courses they're enrolled in.
-- ============================================================

-- Drop old permissive SELECT policies
DROP POLICY IF EXISTS "lesson_comments_select" ON public.lesson_comments;
DROP POLICY IF EXISTS "lesson_ratings_select" ON public.lesson_ratings;

-- Comments: restrict SELECT by enrollment
CREATE POLICY "lesson_comments_select" ON public.lesson_comments
  FOR SELECT TO authenticated
  USING (
    -- admins and teachers see everything
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('administrator', 'teacher')
    )
    OR
    -- students see only lessons in courses they are enrolled in
    EXISTS (
      SELECT 1
      FROM public.video_lessons vl
      JOIN public.course_modules cm ON cm.id = vl.module_id
      JOIN public.class_courses cc ON cc.course_id = cm.course_id
      JOIN public.student_classes sc ON sc.class_id = cc.class_id
      WHERE vl.id = lesson_comments.lesson_id
        AND sc.user_id = auth.uid()
    )
  );

-- Ratings: restrict SELECT by enrollment
CREATE POLICY "lesson_ratings_select" ON public.lesson_ratings
  FOR SELECT TO authenticated
  USING (
    -- admins and teachers see everything
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('administrator', 'teacher')
    )
    OR
    -- students see only lessons in courses they are enrolled in
    EXISTS (
      SELECT 1
      FROM public.video_lessons vl
      JOIN public.course_modules cm ON cm.id = vl.module_id
      JOIN public.class_courses cc ON cc.course_id = cm.course_id
      JOIN public.student_classes sc ON sc.class_id = cc.class_id
      WHERE vl.id = lesson_ratings.lesson_id
        AND sc.user_id = auth.uid()
    )
  );
