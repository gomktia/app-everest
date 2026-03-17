-- Admin delete user function
-- Handles FK cleanup before deleting user from auth.users (cascades to public.users)
CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'administrator' THEN
    RAISE EXCEPTION 'Apenas administradores podem deletar usuários';
  END IF;

  -- Prevent self-deletion
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode deletar sua própria conta';
  END IF;

  -- Clean up tables that reference public.users WITHOUT ON DELETE CASCADE
  DELETE FROM forum_replies WHERE user_id = p_user_id;
  DELETE FROM forum_topics WHERE user_id = p_user_id;

  -- Clean up student data
  DELETE FROM student_classes WHERE user_id = p_user_id;
  DELETE FROM lesson_progress WHERE user_id = p_user_id;
  DELETE FROM quiz_attempts WHERE user_id = p_user_id;
  DELETE FROM flashcard_study_sessions WHERE user_id = p_user_id;
  DELETE FROM flashcard_progress WHERE user_id = p_user_id;
  DELETE FROM user_achievements WHERE user_id = p_user_id;
  DELETE FROM study_plans WHERE user_id = p_user_id;
  DELETE FROM study_sessions WHERE user_id = p_user_id;
  DELETE FROM notifications WHERE user_id = p_user_id;

  -- Nullify references in tables with ON DELETE SET NULL
  UPDATE essay_submissions SET teacher_id = NULL WHERE teacher_id = p_user_id;
  UPDATE question_bank SET created_by_user_id = NULL WHERE created_by_user_id = p_user_id;
  UPDATE evaluation_criteria_templates SET created_by_user_id = NULL WHERE created_by_user_id = p_user_id;

  -- Delete from public.users (which has FK to auth.users with CASCADE)
  DELETE FROM public.users WHERE id = p_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
