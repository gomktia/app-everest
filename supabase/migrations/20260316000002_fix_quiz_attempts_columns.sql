-- Add missing columns to quiz_attempts table
-- The table was created before the simulation migration ran,
-- so CREATE TABLE IF NOT EXISTS skipped adding these columns.

ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS percentage DECIMAL(5,2);
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'submitted';
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}';
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS total_points INTEGER;

-- Backfill started_at from existing attempt_date
UPDATE public.quiz_attempts SET started_at = attempt_date WHERE started_at IS NULL AND attempt_date IS NOT NULL;
