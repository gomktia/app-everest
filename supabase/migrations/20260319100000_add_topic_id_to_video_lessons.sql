-- Add topic_id to video_lessons so lessons can be linked to quiz/flashcard topics
ALTER TABLE public.video_lessons
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.video_lessons.topic_id IS 'Links lesson to a topic for associated quizzes and flashcards';
