-- ============================================================
-- parent_students join table + updated RLS helper
-- ============================================================

CREATE TABLE IF NOT EXISTS public.parent_students (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_students_parent
  ON public.parent_students(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student
  ON public.parent_students(student_id);

ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

-- Parents can see their own links
CREATE POLICY "Parents can view own links"
  ON public.parent_students FOR SELECT
  USING (parent_id = auth.uid());

-- Admins can view links for students in their schools
CREATE POLICY "Admins can view parent_students"
  ON public.parent_students FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.school_id IN (SELECT public.user_school_ids())
    )
  );

-- Admins can insert links for students in their schools
CREATE POLICY "Admins can insert parent_students"
  ON public.parent_students FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.school_id IN (SELECT public.user_school_ids())
    )
  );

-- Admins can delete links for students in their schools
CREATE POLICY "Admins can delete parent_students"
  ON public.parent_students FOR DELETE
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.school_id IN (SELECT public.user_school_ids())
    )
  );

-- Update the helper function to use the join table
CREATE OR REPLACE FUNCTION public.parent_student_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT ps.student_id FROM public.parent_students ps
  WHERE ps.parent_id = auth.uid();
$$;

GRANT ALL ON public.parent_students TO authenticated;
