-- Align with intended behaviour: deleting a student cascades report-card comments.
-- Some deployments had RESTRICT on student_id, which blocked accidental-enrollment cleanup.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'teacher_report_card_comments'
      AND c.conname = 'teacher_report_card_comments_student_id_fkey'
  ) THEN
    ALTER TABLE public.teacher_report_card_comments
      DROP CONSTRAINT teacher_report_card_comments_student_id_fkey;

    ALTER TABLE public.teacher_report_card_comments
      ADD CONSTRAINT teacher_report_card_comments_student_id_fkey
      FOREIGN KEY (student_id)
      REFERENCES public.students (id)
      ON DELETE CASCADE;
  END IF;
END $$;
