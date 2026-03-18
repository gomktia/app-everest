-- Fix admin_delete_user: update table names after forum→community rename,
-- fix essay_submissions→essays, add missing table cleanups,
-- schema-qualify all table references (search_path = '' from linter fix)
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
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

  -- =============================================
  -- Clean up tables referencing public.users WITHOUT ON DELETE CASCADE
  -- (these would block the DELETE FROM public.users)
  -- =============================================

  -- Community (was forum_topics/forum_posts)
  DELETE FROM public.community_comments WHERE user_id = p_user_id;
  DELETE FROM public.community_posts WHERE user_id = p_user_id;

  -- Student enrollment
  DELETE FROM public.student_classes WHERE user_id = p_user_id;

  -- Learning progress
  DELETE FROM public.lesson_progress WHERE user_id = p_user_id;
  DELETE FROM public.flashcard_progress WHERE user_id = p_user_id;
  DELETE FROM public.quiz_attempts WHERE user_id = p_user_id;

  -- Essays: nullify teacher, delete student essays
  UPDATE public.essays SET teacher_id = NULL WHERE teacher_id = p_user_id;
  DELETE FROM public.essays WHERE student_id = p_user_id;

  -- Live events: nullify teacher
  UPDATE public.live_events SET teacher_id = NULL WHERE teacher_id = p_user_id;

  -- Quizzes created by this user: nullify
  UPDATE public.quizzes SET created_by = NULL WHERE created_by = p_user_id;

  -- Evaluation templates
  UPDATE public.evaluation_criteria_templates SET created_by_user_id = NULL WHERE created_by_user_id = p_user_id;

  -- =============================================
  -- Tables with ON DELETE CASCADE on auth.users(id) auto-cleanup:
  -- notifications, user_achievements, user_settings, scores,
  -- video_progress, study_topics, pomodoro_sessions,
  -- flashcard_session_history, lesson_comments, lesson_ratings,
  -- community_reactions, community_attachments, community_reports,
  -- community_mutes, community_poll_votes, user_sessions,
  -- invite_registrations
  -- =============================================

  -- Delete from public.users (triggers CASCADE on tables referencing it)
  DELETE FROM public.users WHERE id = p_user_id;

  -- Delete from auth.users (triggers CASCADE on tables referencing auth.users)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- =============================================
-- Fix get_system_stats: schema-qualify all tables
-- and handle audio_courses which may not exist
-- =============================================
CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result json;
  audio_count bigint := 0;
BEGIN
  -- audio_courses may not exist
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.audio_courses' INTO audio_count;
  EXCEPTION WHEN undefined_table THEN
    audio_count := 0;
  END;

  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM public.users),
    'total_students', (SELECT count(*) FROM public.users WHERE role = 'student'),
    'total_teachers', (SELECT count(*) FROM public.users WHERE role = 'teacher'),
    'total_administrators', (SELECT count(*) FROM public.users WHERE role = 'administrator'),
    'total_classes', (SELECT count(*) FROM public.classes),
    'total_courses', (SELECT count(*) FROM public.video_courses),
    'total_flashcards', (SELECT count(*) FROM public.flashcards),
    'total_quizzes', (SELECT count(*) FROM public.quizzes),
    'total_essays', (SELECT count(*) FROM public.essays),
    'total_audio_courses', audio_count,
    'active_users', (SELECT count(DISTINCT user_id) FROM public.user_sessions WHERE created_at > now() - interval '30 days'),
    'completion_rate', (
      CASE
        WHEN (SELECT count(*) FROM public.video_progress) = 0 THEN 0
        ELSE round(((SELECT count(*) FROM public.video_progress WHERE is_completed = true)::numeric / (SELECT count(*) FROM public.video_progress)::numeric) * 100)
      END
    )
  ) INTO result;

  RETURN result;
END;
$$;
