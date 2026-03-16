-- Fix: quiz_attempts.score and total_questions are NOT NULL without defaults
-- This causes insert to fail when creating in-progress attempts (score unknown yet)
ALTER TABLE quiz_attempts ALTER COLUMN score SET DEFAULT 0;
ALTER TABLE quiz_attempts ALTER COLUMN total_questions SET DEFAULT 0;
