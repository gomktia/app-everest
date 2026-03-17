-- Fix: register_invite_slot was not setting subscription_expires_at
-- Root cause: integer || text concatenation fails silently in some contexts
-- Solution: use explicit CAST and MAKE INTERVAL instead

DROP FUNCTION IF EXISTS public.register_invite_slot(UUID, UUID);

CREATE OR REPLACE FUNCTION public.register_invite_slot(
  p_invite_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_slots INT;
  v_current_count INT;
  v_class_id UUID;
  v_course_id UUID;
  v_access_duration INT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Lock the invite row to prevent concurrent reads
  SELECT max_slots, class_id, course_id, access_duration_days
  INTO v_max_slots, v_class_id, v_course_id, v_access_duration
  FROM public.invites
  WHERE id = p_invite_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite nao encontrado ou inativo';
  END IF;

  -- Check slot availability (if limited)
  IF v_max_slots IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.invite_registrations
    WHERE invite_id = p_invite_id;

    IF v_current_count >= v_max_slots THEN
      RETURN FALSE; -- Vagas esgotadas
    END IF;
  END IF;

  -- Insert registration atomically
  INSERT INTO public.invite_registrations (invite_id, user_id)
  VALUES (p_invite_id, p_user_id)
  ON CONFLICT (invite_id, user_id) DO NOTHING;

  -- Enroll student in class (SECURITY DEFINER bypasses RLS)
  IF v_class_id IS NOT NULL THEN
    -- Calculate expiration using MAKE_INTERVAL (safe for integer input)
    IF v_access_duration IS NOT NULL AND v_access_duration > 0 THEN
      v_expires_at := NOW() + MAKE_INTERVAL(days => v_access_duration);
    ELSE
      v_expires_at := NULL;
    END IF;

    INSERT INTO public.student_classes (user_id, class_id, source, enrollment_date, subscription_expires_at)
    VALUES (p_user_id, v_class_id, 'invite', CURRENT_DATE, v_expires_at)
    ON CONFLICT (user_id, class_id) DO UPDATE SET
      subscription_expires_at = COALESCE(EXCLUDED.subscription_expires_at, student_classes.subscription_expires_at),
      source = 'invite';

    -- Ensure course is linked to class
    IF v_course_id IS NOT NULL THEN
      INSERT INTO public.class_courses (class_id, course_id)
      VALUES (v_class_id, v_course_id)
      ON CONFLICT (class_id, course_id) DO NOTHING;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;
