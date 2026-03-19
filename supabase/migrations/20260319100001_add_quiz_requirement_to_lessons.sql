-- Add quiz requirement fields to video_lessons
ALTER TABLE public.video_lessons
  ADD COLUMN IF NOT EXISTS quiz_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quiz_min_percentage INTEGER DEFAULT 70;

COMMENT ON COLUMN public.video_lessons.quiz_required IS 'If true, student must pass the topic quiz to complete this lesson';
COMMENT ON COLUMN public.video_lessons.quiz_min_percentage IS 'Minimum percentage to pass the quiz (e.g. 70)';
