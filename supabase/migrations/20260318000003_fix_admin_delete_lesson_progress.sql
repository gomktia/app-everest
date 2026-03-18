-- Fix admin_delete_user: remove lesson_progress (table doesn't exist)
-- video_progress has ON DELETE CASCADE on auth.users so auto-cleans
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

  -- Community (was forum_topics/forum_posts)
  DELETE FROM public.community_comments WHERE user_id = p_user_id;
  DELETE FROM public.community_posts WHERE user_id = p_user_id;

  -- Student enrollment
  DELETE FROM public.student_classes WHERE user_id = p_user_id;

  -- Learning progress (video_progress has CASCADE on auth.users, no need here)
  DELETE FROM public.flashcard_progress WHERE user_id = p_user_id;
  DELETE FROM public.quiz_attempts WHERE user_id = p_user_id;

  -- Essays: nullify teacher ref, delete student essays
  UPDATE public.essays SET teacher_id = NULL WHERE teacher_id = p_user_id;
  DELETE FROM public.essays WHERE student_id = p_user_id;

  -- Live events: nullify teacher
  UPDATE public.live_events SET teacher_id = NULL WHERE teacher_id = p_user_id;

  -- Quizzes: nullify creator
  UPDATE public.quizzes SET created_by = NULL WHERE created_by = p_user_id;

  -- Evaluation templates: nullify creator
  UPDATE public.evaluation_criteria_templates SET created_by_user_id = NULL WHERE created_by_user_id = p_user_id;

  -- Delete from public.users (tables with CASCADE on public.users auto-cleanup)
  DELETE FROM public.users WHERE id = p_user_id;

  -- Delete from auth.users (tables with CASCADE on auth.users auto-cleanup:
  -- notifications, user_achievements, user_settings, scores, video_progress,
  -- study_topics, pomodoro_sessions, flashcard_session_history, lesson_comments,
  -- lesson_ratings, community_reactions, community_attachments, community_reports,
  -- community_mutes, community_poll_votes, user_sessions, invite_registrations)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
