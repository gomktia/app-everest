-- Fix all RPCs broken by search_path = '' (linter fix 20260315000004)
-- These functions use unqualified table names but search_path is empty,
-- so they can't find any tables. Recreate with public. prefix.

-- 1. update_last_seen (critical: this is why "Nunca acessou" shows for everyone)
CREATE OR REPLACE FUNCTION public.update_last_seen(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET last_seen_at = now()
  WHERE id = p_user_id
    AND (last_seen_at IS NULL OR last_seen_at < now() - interval '5 minutes');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 2. get_ranking
CREATE OR REPLACE FUNCTION public.get_ranking(ranking_limit integer DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  total_xp bigint,
  achievements_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.user_id,
    u.email,
    u.first_name,
    u.last_name,
    COALESCE(SUM(s.score_value), 0)::bigint AS total_xp,
    COALESCE(ac.cnt, 0)::bigint AS achievements_count
  FROM public.scores s
  JOIN public.users u ON u.id = s.user_id
  LEFT JOIN (
    SELECT ua.user_id, COUNT(*) AS cnt
    FROM public.user_achievements ua
    GROUP BY ua.user_id
  ) ac ON ac.user_id = s.user_id
  GROUP BY s.user_id, u.email, u.first_name, u.last_name, ac.cnt
  ORDER BY total_xp DESC
  LIMIT ranking_limit;
$$;

-- 3. get_gamification_stats
CREATE OR REPLACE FUNCTION public.get_gamification_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'total_achievements', (SELECT COUNT(*) FROM public.achievements),
    'total_unlocked', (SELECT COUNT(*) FROM public.user_achievements),
    'total_xp', (SELECT COALESCE(SUM(score_value), 0) FROM public.scores),
    'active_users', (SELECT COUNT(DISTINCT user_id) FROM public.scores)
  );
$$;

-- 4. get_total_xp
CREATE OR REPLACE FUNCTION public.get_total_xp()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(score_value), 0)::bigint FROM public.scores;
$$;

-- 5. get_ranking_by_class
CREATE OR REPLACE FUNCTION public.get_ranking_by_class(
  p_class_id uuid,
  ranking_limit integer DEFAULT 50
)
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  total_xp bigint,
  achievements_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.user_id,
    u.email,
    u.first_name,
    u.last_name,
    COALESCE(SUM(s.score_value), 0)::bigint AS total_xp,
    COALESCE(ac.cnt, 0)::bigint AS achievements_count
  FROM public.scores s
  JOIN public.users u ON u.id = s.user_id
  JOIN public.student_classes sc ON sc.user_id = s.user_id AND sc.class_id = p_class_id
  LEFT JOIN (
    SELECT ua.user_id, COUNT(*) AS cnt
    FROM public.user_achievements ua
    JOIN public.student_classes sc2 ON sc2.user_id = ua.user_id AND sc2.class_id = p_class_id
    GROUP BY ua.user_id
  ) ac ON ac.user_id = s.user_id
  GROUP BY s.user_id, u.email, u.first_name, u.last_name, ac.cnt
  ORDER BY total_xp DESC
  LIMIT ranking_limit;
$$;

-- 6. get_import_stats
CREATE OR REPLACE FUNCTION public.get_import_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'total_questions', (SELECT COUNT(*) FROM public.quiz_questions),
    'total_flashcards', (SELECT COUNT(*) FROM public.flashcards),
    'total_subjects', (SELECT COUNT(*) FROM public.subjects),
    'total_topics', (SELECT COUNT(*) FROM public.topics),
    'questions_by_source', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT source_exam, source_year, COUNT(*) as count
        FROM public.quiz_questions
        WHERE source_exam IS NOT NULL
        GROUP BY source_exam, source_year
        ORDER BY source_exam, source_year DESC
      ) t
    ),
    'flashcards_by_source', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT source_exam, source_type, COUNT(*) as count
        FROM public.flashcards
        WHERE source_exam IS NOT NULL
        GROUP BY source_exam, source_type
        ORDER BY source_exam
      ) t
    ),
    'recent_imports', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT id, job_type, source_name, status,
               total_items, imported_items, failed_items, duplicate_items,
               questions_created, flashcards_created,
               started_at, completed_at
        FROM public.import_jobs
        ORDER BY created_at DESC
        LIMIT 10
      ) t
    ),
    'questions_by_difficulty', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT difficulty, COUNT(*) as count
        FROM public.quiz_questions
        GROUP BY difficulty
        ORDER BY difficulty
      ) t
    ),
    'acervo_stats', (
      SELECT json_build_object(
        'total_items', (SELECT COUNT(*) FROM public.acervo_items),
        'by_category', (
          SELECT json_agg(row_to_json(t))
          FROM (
            SELECT category, COUNT(*) as count
            FROM public.acervo_items
            GROUP BY category
            ORDER BY count DESC
          ) t
        ),
        'by_concurso', (
          SELECT json_agg(row_to_json(t))
          FROM (
            SELECT concurso, COUNT(*) as count
            FROM public.acervo_items
            WHERE concurso IS NOT NULL
            GROUP BY concurso
            ORDER BY count DESC
          ) t
        )
      )
    )
  );
$$;
