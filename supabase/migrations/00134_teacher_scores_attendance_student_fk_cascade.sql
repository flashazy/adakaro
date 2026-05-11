-- Match intended schema: student delete cascades gradebook scores and attendance.
-- Some DBs had RESTRICT on student_id, blocking accidental-enrollment cleanup.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'teacher_scores'
      AND c.conname = 'teacher_scores_student_id_fkey'
  ) THEN
    ALTER TABLE public.teacher_scores
      DROP CONSTRAINT teacher_scores_student_id_fkey;
    ALTER TABLE public.teacher_scores
      ADD CONSTRAINT teacher_scores_student_id_fkey
      FOREIGN KEY (student_id)
      REFERENCES public.students (id)
      ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'teacher_attendance'
      AND c.conname = 'teacher_attendance_student_id_fkey'
  ) THEN
    ALTER TABLE public.teacher_attendance
      DROP CONSTRAINT teacher_attendance_student_id_fkey;
    ALTER TABLE public.teacher_attendance
      ADD CONSTRAINT teacher_attendance_student_id_fkey
      FOREIGN KEY (student_id)
      REFERENCES public.students (id)
      ON DELETE CASCADE;
  END IF;
END $$;
