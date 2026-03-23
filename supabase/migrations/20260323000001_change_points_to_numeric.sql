-- Allow decimal points values (e.g. 0.5) for quiz questions
ALTER TABLE quiz_questions ALTER COLUMN points TYPE numeric(5,2) USING points::numeric(5,2);
