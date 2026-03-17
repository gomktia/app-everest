-- Fix: Add missing unique constraints needed by register_invite_slot RPC
-- The ON CONFLICT clauses in the RPC require these constraints to exist

-- student_classes: unique on (user_id, class_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_classes_user_class_unique'
  ) THEN
    ALTER TABLE public.student_classes
    ADD CONSTRAINT student_classes_user_class_unique
    UNIQUE (user_id, class_id);
  END IF;
END $$;

-- invite_registrations: unique on (invite_id, user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invite_registrations_invite_user_unique'
  ) THEN
    ALTER TABLE public.invite_registrations
    ADD CONSTRAINT invite_registrations_invite_user_unique
    UNIQUE (invite_id, user_id);
  END IF;
END $$;

-- class_courses: unique on (class_id, course_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'class_courses_class_course_unique'
  ) THEN
    ALTER TABLE public.class_courses
    ADD CONSTRAINT class_courses_class_course_unique
    UNIQUE (class_id, course_id);
  END IF;
END $$;
