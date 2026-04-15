-- Term for gradebook assignments (aligns with student_subject_enrollment / report cards).

ALTER TABLE public.teacher_gradebook_assignments
  ADD COLUMN IF NOT EXISTS term text;

ALTER TABLE public.teacher_gradebook_assignments
  DROP CONSTRAINT IF EXISTS teacher_gradebook_assignments_term_check;

ALTER TABLE public.teacher_gradebook_assignments
  ADD CONSTRAINT teacher_gradebook_assignments_term_check
  CHECK (term IS NULL OR term IN ('Term 1', 'Term 2'));

CREATE INDEX IF NOT EXISTS idx_teacher_gradebook_assignments_class_subject_term
  ON public.teacher_gradebook_assignments (class_id, subject, term);
