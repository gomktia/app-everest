-- Migration: AI Features
-- Adds AI audit columns to quiz_questions, creates ai_usage_log table,
-- and seeds AI feature settings into system_settings.

-- ============================================================
-- 1. Add columns to quiz_questions
-- ============================================================
ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_audited_at timestamptz;

-- ============================================================
-- 2. Create ai_usage_log table
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        REFERENCES users(id) ON DELETE SET NULL,
  feature            text        NOT NULL CHECK (feature IN ('audit', 'explain', 'quiz_gen', 'lesson_chat', 'study_plan')),
  tokens_input       int         DEFAULT 0,
  tokens_output      int         DEFAULT 0,
  cost_estimate_brl  numeric(10,4) DEFAULT 0,
  model              text        DEFAULT 'gemini-2.5-flash',
  metadata           jsonb       DEFAULT '{}',
  created_at         timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS ai_usage_log_created_at_idx ON ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_log_feature_idx    ON ai_usage_log (feature);

-- ============================================================
-- 3. RLS for ai_usage_log
-- ============================================================
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Admins and teachers can read all rows
CREATE POLICY "admins_teachers_can_read_ai_usage_log"
  ON ai_usage_log
  FOR SELECT
  TO authenticated
  USING (get_auth_user_role() IN ('administrator', 'teacher'));

-- Edge Functions (service_role) bypass RLS entirely — no explicit policy needed.
-- Students/anonymous have no access by default (no matching policy).

-- ============================================================
-- 4. Insert / upsert AI feature settings into system_settings
-- ============================================================
INSERT INTO system_settings (key, value)
VALUES (
  'ai_features',
  jsonb_build_object(
    'master',               true,
    'audit',                true,
    'lesson_chat',          true,
    'quiz_gen',             true,
    'study_plan',           true,
    'rate_limit_per_minute', 10,
    'cost_alert_threshold', 500
  )
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value;
