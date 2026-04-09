-- Gender for student demographics (lesson plans, class counts). Backfill NULL → 'other'.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other')) DEFAULT 'other';

UPDATE public.students
SET gender = 'other'
WHERE gender IS NULL;
