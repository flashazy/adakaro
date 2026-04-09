-- Tanzania government lesson plan fields: activities, teaching resources, references.
-- The column must be named "references" (quoted) — REFERENCES is reserved in PostgreSQL.

ALTER TABLE public.lesson_plans
  ADD COLUMN IF NOT EXISTS main_activities TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS specific_activities TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS teaching_resources TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "references" TEXT NOT NULL DEFAULT '';
