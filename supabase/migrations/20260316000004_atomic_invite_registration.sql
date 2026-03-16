-- Atomic invite slot check to prevent race condition overbooking
-- This RPC checks slots and inserts registration in a single transaction

CREATE OR REPLACE FUNCTION public.register_invite_slot(
  p_invite_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_slots INT;
  v_current_count INT;
BEGIN
  -- Lock the invite row to prevent concurrent reads
  SELECT max_slots INTO v_max_slots
  FROM public.invites
  WHERE id = p_invite_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite nao encontrado ou inativo';
  END IF;

  -- If no slot limit, just insert
  IF v_max_slots IS NULL THEN
    INSERT INTO public.invite_registrations (invite_id, user_id)
    VALUES (p_invite_id, p_user_id)
    ON CONFLICT (invite_id, user_id) DO NOTHING;
    RETURN TRUE;
  END IF;

  -- Count current registrations
  SELECT COUNT(*) INTO v_current_count
  FROM public.invite_registrations
  WHERE invite_id = p_invite_id;

  IF v_current_count >= v_max_slots THEN
    RETURN FALSE; -- Vagas esgotadas
  END IF;

  -- Insert registration atomically
  INSERT INTO public.invite_registrations (invite_id, user_id)
  VALUES (p_invite_id, p_user_id)
  ON CONFLICT (invite_id, user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;
