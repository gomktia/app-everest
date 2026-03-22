-- Make live_events.teacher_id nullable (to allow SET NULL on user deletion)
ALTER TABLE public.live_events ALTER COLUMN teacher_id DROP NOT NULL;

-- Fix the FK to SET NULL
ALTER TABLE public.live_events DROP CONSTRAINT IF EXISTS live_events_teacher_id_fkey;
ALTER TABLE public.live_events ADD CONSTRAINT live_events_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Recreate admin_delete_user with proper error handling
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'administrator' THEN
    RAISE EXCEPTION 'Apenas administradores podem deletar usuários';
  END IF;
  -- Prevent self-deletion
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode deletar sua própria conta';
  END IF;
  -- Prevent deleting last admin
  IF (SELECT role FROM public.users WHERE id = p_user_id) = 'administrator' THEN
    IF (SELECT count(*) FROM public.users WHERE role = 'administrator' AND id != p_user_id) < 1 THEN
      RAISE EXCEPTION 'Não é possível deletar o último administrador do sistema';
    END IF;
  END IF;

  -- Reassign or nullify references that can't cascade
  UPDATE public.live_events SET teacher_id = NULL WHERE teacher_id = p_user_id;
  UPDATE public.essays SET teacher_id = NULL WHERE teacher_id = p_user_id;
  UPDATE public.quizzes SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE public.evaluation_criteria_templates SET created_by_user_id = NULL WHERE created_by_user_id = p_user_id;
  UPDATE public.system_settings SET updated_by = NULL WHERE updated_by = p_user_id;
  UPDATE public.video_courses SET created_by_user_id = (
    SELECT id FROM public.users WHERE role = 'administrator' AND id != p_user_id LIMIT 1
  ) WHERE created_by_user_id = p_user_id;

  -- Delete from auth.users — CASCADE handles public.users and all related tables
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
