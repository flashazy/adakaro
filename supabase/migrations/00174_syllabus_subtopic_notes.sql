-- Teacher notes per subtopic (optional, per teacher).

CREATE TABLE IF NOT EXISTS public.syllabus_subtopic_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  subtopic_id uuid NOT NULL REFERENCES public.syllabus_subtopics(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT syllabus_subtopic_notes_length CHECK (
    char_length(trim(note)) > 0 AND char_length(note) <= 1000
  ),
  UNIQUE (subtopic_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS syllabus_subtopic_notes_teacher_idx
  ON public.syllabus_subtopic_notes (teacher_id, subtopic_id);

DROP TRIGGER IF EXISTS syllabus_subtopic_notes_updated_at ON public.syllabus_subtopic_notes;
CREATE TRIGGER syllabus_subtopic_notes_updated_at
  BEFORE UPDATE ON public.syllabus_subtopic_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_subtopic_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_subtopic_notes TO service_role;

ALTER TABLE public.syllabus_subtopic_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syllabus_subtopic_notes_select" ON public.syllabus_subtopic_notes;
CREATE POLICY "syllabus_subtopic_notes_select"
  ON public.syllabus_subtopic_notes FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.is_class_coordinator(class_id)
    OR public.is_school_coordinator(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
    OR teacher_id = auth.uid()
    OR public.is_teacher_for_class_subject(class_id, subject_id)
  );

DROP POLICY IF EXISTS "syllabus_subtopic_notes_insert" ON public.syllabus_subtopic_notes;
CREATE POLICY "syllabus_subtopic_notes_insert"
  ON public.syllabus_subtopic_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND public.is_teacher_for_class_subject(class_id, subject_id)
  );

DROP POLICY IF EXISTS "syllabus_subtopic_notes_update" ON public.syllabus_subtopic_notes;
CREATE POLICY "syllabus_subtopic_notes_update"
  ON public.syllabus_subtopic_notes FOR UPDATE
  TO authenticated
  USING (
    teacher_id = auth.uid()
    AND public.is_teacher_for_class_subject(class_id, subject_id)
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND public.is_teacher_for_class_subject(class_id, subject_id)
  );

DROP POLICY IF EXISTS "syllabus_subtopic_notes_delete" ON public.syllabus_subtopic_notes;
CREATE POLICY "syllabus_subtopic_notes_delete"
  ON public.syllabus_subtopic_notes FOR DELETE
  TO authenticated
  USING (
    teacher_id = auth.uid()
    AND public.is_teacher_for_class_subject(class_id, subject_id)
  );
