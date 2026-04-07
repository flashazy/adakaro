-- School-scoped subjects catalog; optional subject_id on teacher_assignments (legacy `subject` text kept).

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  code varchar(50),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_subjects_school ON public.subjects (school_id);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Aligns with other school tables: is_school_admin / is_teacher_for_school / is_super_admin.
CREATE POLICY "subjects_select"
  ON public.subjects FOR SELECT
  USING (
    public.is_school_admin(school_id)
    OR public.is_teacher_for_school(school_id)
    OR public.is_super_admin()
  );

CREATE POLICY "subjects_insert_admin"
  ON public.subjects FOR INSERT
  WITH CHECK (
    public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

CREATE POLICY "subjects_update_admin"
  ON public.subjects FOR UPDATE
  USING (
    public.is_school_admin(school_id)
    OR public.is_super_admin()
  )
  WITH CHECK (
    public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

CREATE POLICY "subjects_delete_admin"
  ON public.subjects FOR DELETE
  USING (
    public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_assignments
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE RESTRICT;
