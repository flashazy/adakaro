-- Restrict gender to male/female only. Migrate legacy values before tightening CHECK.

UPDATE public.students
SET gender = 'male'
WHERE gender IS NULL OR gender = 'other';

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_gender_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_gender_check CHECK (gender IN ('male', 'female'));

ALTER TABLE public.students
  ALTER COLUMN gender SET DEFAULT 'male';
