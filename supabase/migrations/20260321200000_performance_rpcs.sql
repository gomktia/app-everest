-- ============================================================
-- Performance RPCs: Move client-side aggregation to database
-- ============================================================

-- 1. RPC: get_user_growth_data
-- Replaces: adminStatsService.getUserGrowthData() which fetched ALL users
-- and filtered in browser. Now does GROUP BY in the database.
CREATE OR REPLACE FUNCTION public.get_user_growth_data(p_months int DEFAULT 6)
RETURNS TABLE(month_label text, total_users bigint, active_users bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - ((p_months - 1) || ' months')::interval,
      date_trunc('month', now()),
      '1 month'::interval
    ) AS month_start
  ),
  user_counts AS (
    SELECT
      m.month_start,
      (SELECT count(*) FROM users WHERE created_at < m.month_start + '1 month'::interval) AS total_users
    FROM months m
  ),
  session_counts AS (
    SELECT
      date_trunc('month', created_at) AS month_start,
      count(DISTINCT user_id) AS active_users
    FROM user_sessions
    WHERE created_at >= date_trunc('month', now()) - ((p_months - 1) || ' months')::interval
    GROUP BY date_trunc('month', created_at)
  )
  SELECT
    to_char(uc.month_start, 'Mon') AS month_label,
    uc.total_users,
    COALESCE(sc.active_users, 0) AS active_users
  FROM user_counts uc
  LEFT JOIN session_counts sc ON sc.month_start = uc.month_start
  ORDER BY uc.month_start;
$$;

-- 2. RPC: get_weekly_activity_data
-- Replaces: adminStatsService.getWeeklyActivityData() which fetched 15000+ rows
-- and aggregated in browser. Now does COUNT + GROUP BY in the database.
CREATE OR REPLACE FUNCTION public.get_weekly_activity_data(p_days int DEFAULT 7)
RETURNS TABLE(day_of_week int, activity_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH range_start AS (
    SELECT (now() - (p_days || ' days')::interval)::date AS start_date
  ),
  all_activities AS (
    SELECT created_at AS ts FROM user_sessions WHERE created_at >= (SELECT start_date FROM range_start)
    UNION ALL
    SELECT created_at AS ts FROM quiz_attempts WHERE created_at >= (SELECT start_date FROM range_start)
    UNION ALL
    SELECT started_at AS ts FROM flashcard_session_history WHERE started_at >= (SELECT start_date FROM range_start)
  )
  SELECT
    extract(dow FROM ts)::int AS day_of_week,
    count(*) AS activity_count
  FROM all_activities
  GROUP BY extract(dow FROM ts)::int
  ORDER BY day_of_week;
$$;

-- 3. Add missing indexes for the new RPCs
CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at
  ON user_sessions (created_at);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created_at
  ON quiz_attempts (created_at);

CREATE INDEX IF NOT EXISTS idx_flashcard_session_history_started_at
  ON flashcard_session_history (started_at);

-- 4. Analyze tables used by new RPCs
ANALYZE user_sessions;
ANALYZE quiz_attempts;
ANALYZE flashcard_session_history;
