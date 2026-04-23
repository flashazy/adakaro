-- Ensure teacher_attendance.updated_at exists (legacy DBs); core schema already includes it.

ALTER TABLE public.teacher_attendance
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.teacher_attendance
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE public.teacher_attendance
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.teacher_attendance
  ALTER COLUMN updated_at SET NOT NULL;
