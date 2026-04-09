-- Tanzania government: Teaching and Learning Process (4×4 grid) as JSONB.

ALTER TABLE public.lesson_plans
  ADD COLUMN IF NOT EXISTS teaching_learning_process jsonb NOT NULL DEFAULT '{}'::jsonb;
