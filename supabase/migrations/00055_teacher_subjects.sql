-- Links teachers to subjects they teach (for lesson plan subject dropdowns, etc.).

CREATE TABLE public.teacher_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, subject_id)
);

CREATE INDEX idx_teacher_subjects_teacher ON public.teacher_subjects (teacher_id);
CREATE INDEX idx_teacher_subjects_subject ON public.teacher_subjects (subject_id);

ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_subjects_select_own"
  ON public.teacher_subjects FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "teacher_subjects_insert_own"
  ON public.teacher_subjects FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "teacher_subjects_delete_own"
  ON public.teacher_subjects FOR DELETE
  USING (auth.uid() = teacher_id);

-- School admins can manage assignments for their school via subjects join if needed later;
-- for now teachers only see own rows.
