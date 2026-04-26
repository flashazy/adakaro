-- Replace manual term snapshots / fee & scholarship data entry with simple staff finance notes.

CREATE TABLE public.student_finance_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_finance_notes_body_not_empty CHECK (length(trim(body)) > 0)
);

CREATE INDEX idx_student_finance_notes_student_created
  ON public.student_finance_notes (student_id, created_at DESC);

CREATE TRIGGER student_finance_notes_updated_at
  BEFORE UPDATE ON public.student_finance_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.student_finance_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_finance_notes_select"
  ON public.student_finance_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_finance_notes.student_id
        AND (
          public.is_school_admin(s.school_id)
          OR public.is_super_admin()
          OR public.is_teacher_for_class(s.class_id)
        )
    )
  );

-- Same editors as fee payments (see 00109 student_finance_record_editor_for_student)
CREATE POLICY "student_finance_notes_insert"
  ON public.student_finance_notes FOR INSERT
  WITH CHECK (public.student_finance_record_editor_for_student(student_id));

CREATE POLICY "student_finance_notes_update"
  ON public.student_finance_notes FOR UPDATE
  USING (public.student_finance_record_editor_for_student(student_id))
  WITH CHECK (public.student_finance_record_editor_for_student(student_id));

CREATE POLICY "student_finance_notes_delete"
  ON public.student_finance_notes FOR DELETE
  USING (public.student_finance_record_editor_for_student(student_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_finance_notes TO authenticated;
GRANT ALL ON public.student_finance_notes TO service_role;

-- Legacy: term snapshots with fee / scholarship / payment_notes columns
DROP TABLE IF EXISTS public.student_finance_records CASCADE;
