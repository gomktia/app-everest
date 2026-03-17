-- Fix v3: register_invite_slot was not setting subscription_expires_at
-- Using explicit interval arithmetic that definitely works in PG 14+

DROP FUNCTION IF EXISTS public.register_invite_slot(UUID, UUID);

CREATE FUNCTION public.register_invite_slot(
  p_invite_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_current_count INT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Lock the invite row to prevent concurrent reads
  SELECT * INTO v_invite
  FROM public.invites
  WHERE id = p_invite_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite nao encontrado ou inativo';
  END IF;

  -- Check slot availability (if limited)
  IF v_invite.max_slots IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.invite_registrations
    WHERE invite_id = p_invite_id;

    IF v_current_count >= v_invite.max_slots THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Insert registration atomically
  INSERT INTO public.invite_registrations (invite_id, user_id)
  VALUES (p_invite_id, p_user_id)
  ON CONFLICT (invite_id, user_id) DO NOTHING;

  -- Enroll student in class
  IF v_invite.class_id IS NOT NULL THEN
    -- Calculate expiration
    IF v_invite.access_duration_days IS NOT NULL AND v_invite.access_duration_days > 0 THEN
      v_expires_at := NOW() + (v_invite.access_duration_days * INTERVAL '1 day');
    ELSE
      v_expires_at := NULL;
    END IF;

    INSERT INTO public.student_classes (user_id, class_id, source, enrollment_date, subscription_expires_at)
    VALUES (p_user_id, v_invite.class_id, 'invite', CURRENT_DATE, v_expires_at)
    ON CONFLICT (user_id, class_id) DO UPDATE SET
      subscription_expires_at = COALESCE(EXCLUDED.subscription_expires_at, student_classes.subscription_expires_at),
      source = 'invite';

    -- Ensure course is linked to class
    IF v_invite.course_id IS NOT NULL THEN
      INSERT INTO public.class_courses (class_id, course_id)
      VALUES (v_invite.class_id, v_invite.course_id)
      ON CONFLICT (class_id, course_id) DO NOTHING;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;
