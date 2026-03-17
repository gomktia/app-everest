-- Recreate submit_quiz_attempt RPC function
-- This function was defined in 20251004000000 but is missing from the production schema cache.
-- Re-creating it ensures it exists.

CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_attempt_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_time_spent INTEGER;
  v_total_points DECIMAL(5,2);
  v_points_earned DECIMAL(5,2);
  v_total_questions INTEGER;
  v_correct_answers INTEGER;
  v_incorrect_answers INTEGER;
  v_unanswered INTEGER;
BEGIN
  -- Calculate time spent
  SELECT EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
  INTO v_time_spent
  FROM public.quiz_attempts
  WHERE id = p_attempt_id;

  -- Grade answers: compare answer_value to correct_answer
  UPDATE public.quiz_answers qa
  SET
    is_correct = (qa.answer_value = qq.correct_answer),
    points_earned = CASE WHEN qa.answer_value = qq.correct_answer THEN COALESCE(qq.points, 1) ELSE 0 END,
    updated_at = NOW()
  FROM public.quiz_questions qq
  WHERE qa.question_id = qq.id
    AND qa.attempt_id = p_attempt_id;

  -- Mark as submitted
  UPDATE public.quiz_attempts
  SET
    status = 'submitted',
    submitted_at = NOW(),
    time_spent_seconds = v_time_spent,
    updated_at = NOW()
  WHERE id = p_attempt_id;

  -- Calculate totals
  SELECT
    COALESCE(SUM(COALESCE(points, 1)), 0),
    COUNT(*)
  INTO v_total_points, v_total_questions
  FROM public.quiz_questions qq
  INNER JOIN public.quiz_attempts qa ON qa.quiz_id = qq.quiz_id
  WHERE qa.id = p_attempt_id;

  SELECT COALESCE(SUM(points_earned), 0)
  INTO v_points_earned
  FROM public.quiz_answers
  WHERE attempt_id = p_attempt_id;

  SELECT
    COUNT(*) FILTER (WHERE is_correct = true),
    COUNT(*) FILTER (WHERE is_correct = false)
  INTO v_correct_answers, v_incorrect_answers
  FROM public.quiz_answers
  WHERE attempt_id = p_attempt_id;

  v_unanswered := v_total_questions - (v_correct_answers + v_incorrect_answers);

  -- Update attempt with scores
  UPDATE public.quiz_attempts
  SET
    score = v_points_earned,
    total_points = v_total_points,
    percentage = CASE WHEN v_total_points > 0 THEN ROUND((v_points_earned / v_total_points * 100)::numeric, 2) ELSE 0 END,
    updated_at = NOW()
  WHERE id = p_attempt_id;

  -- Build result
  v_result := jsonb_build_object(
    'total_points', v_total_points,
    'points_earned', v_points_earned,
    'percentage', CASE WHEN v_total_points > 0 THEN ROUND((v_points_earned / v_total_points * 100)::numeric, 2) ELSE 0 END,
    'total_questions', v_total_questions,
    'correct_answers', v_correct_answers,
    'incorrect_answers', v_incorrect_answers,
    'unanswered', v_unanswered
  );

  -- Update per-question stats
  INSERT INTO public.quiz_question_stats (question_id, quiz_id, total_answers, correct_answers, incorrect_answers)
  SELECT
    qa.question_id,
    qq.quiz_id,
    1,
    CASE WHEN qa.is_correct THEN 1 ELSE 0 END,
    CASE WHEN NOT qa.is_correct THEN 1 ELSE 0 END
  FROM public.quiz_answers qa
  INNER JOIN public.quiz_questions qq ON qq.id = qa.question_id
  WHERE qa.attempt_id = p_attempt_id
  ON CONFLICT (question_id) DO UPDATE
  SET
    total_answers = quiz_question_stats.total_answers + 1,
    correct_answers = quiz_question_stats.correct_answers + EXCLUDED.correct_answers,
    incorrect_answers = quiz_question_stats.incorrect_answers + EXCLUDED.incorrect_answers,
    updated_at = NOW();

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
