-- Per-subject attendance: allow multiple rows per student per class per day
-- (one per subject), while keeping legacy class-wide rows (subject_id NULL).

ALTER TABLE public.teacher_attendance
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

ALTER TABLE public.teacher_attendance
  ADD COLUMN IF NOT EXISTS attendance_scope_key text NOT NULL DEFAULT '';

UPDATE public.teacher_attendance
SET attendance_scope_key = COALESCE(subject_id::text, '')
WHERE attendance_scope_key IS DISTINCT FROM COALESCE(subject_id::text, '');

CREATE OR REPLACE FUNCTION public.teacher_attendance_sync_scope_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.subject_id IS NULL THEN
    NEW.attendance_scope_key := '';
  ELSE
    NEW.attendance_scope_key := NEW.subject_id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teacher_attendance_sync_scope_key ON public.teacher_attendance;
CREATE TRIGGER trg_teacher_attendance_sync_scope_key
  BEFORE INSERT OR UPDATE ON public.teacher_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.teacher_attendance_sync_scope_key();

ALTER TABLE public.teacher_attendance
  DROP CONSTRAINT IF EXISTS teacher_attendance_student_id_attendance_date_class_id_key;
ALTER TABLE public.teacher_attendance
  DROP CONSTRAINT IF EXISTS teacher_attendance_class_student_attendance_date_key;

DROP INDEX IF EXISTS public.teacher_attendance_scope_unique;
CREATE UNIQUE INDEX teacher_attendance_scope_unique
  ON public.teacher_attendance (class_id, student_id, attendance_date, attendance_scope_key);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_class_date_scope
  ON public.teacher_attendance (class_id, attendance_date, attendance_scope_key);
