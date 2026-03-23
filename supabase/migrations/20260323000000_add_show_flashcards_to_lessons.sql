-- Add show_flashcards toggle to video_lessons
-- Allows teachers to control whether flashcard button appears in lessons
ALTER TABLE video_lessons ADD COLUMN IF NOT EXISTS show_flashcards boolean DEFAULT true;
