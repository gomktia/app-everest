-- Add 'invite' and 'tasting' as valid sources for student_classes
ALTER TABLE student_classes DROP CONSTRAINT IF EXISTS student_classes_source_check;
ALTER TABLE student_classes
  ADD CONSTRAINT student_classes_source_check
  CHECK (source IN ('manual', 'memberkit', 'kiwify', 'invite', 'tasting'));

-- Also add RLS policy for class_courses so students can read their own class courses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Students read own class courses' AND tablename = 'class_courses'
  ) THEN
    CREATE POLICY "Students read own class courses"
      ON class_courses FOR SELECT TO authenticated
      USING (
        class_id IN (
          SELECT class_id FROM student_classes WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
