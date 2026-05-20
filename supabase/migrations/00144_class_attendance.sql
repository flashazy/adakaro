-- Official daily class attendance (class teacher only). Separate from subject Class List.

CREATE TABLE IF NOT EXISTS public.class_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL,
  notes text,
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_attendance_status_check CHECK (
    status IN ('present', 'absent', 'late', 'sick', 'permitted')
  ),
  CONSTRAINT class_attendance_class_date_student_key UNIQUE (
    class_id,
    attendance_date,
    student_id
  )
);

CREATE INDEX IF NOT EXISTS idx_class_attendance_school_id
  ON public.class_attendance (school_id);

CREATE INDEX IF NOT EXISTS idx_class_attendance_class_id
  ON public.class_attendance (class_id);

CREATE INDEX IF NOT EXISTS idx_class_attendance_attendance_date
  ON public.class_attendance (attendance_date);

CREATE INDEX IF NOT EXISTS idx_class_attendance_student_id
  ON public.class_attendance (student_id);

CREATE INDEX IF NOT EXISTS idx_class_attendance_class_date
  ON public.class_attendance (class_id, attendance_date DESC);

COMMENT ON TABLE public.class_attendance IS
  'Official daily class-wide attendance recorded by the assigned class teacher.';

DROP TRIGGER IF EXISTS class_attendance_updated_at ON public.class_attendance;
CREATE TRIGGER class_attendance_updated_at
  BEFORE UPDATE ON public.class_attendance
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_class_teacher_for_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = p_class_id
      AND c.class_teacher_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_class_teacher_for_class(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_class_teacher_for_class(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_class_attendance(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.id = p_class_id
        AND (
          public.is_school_admin(c.school_id)
          OR public.is_school_head_teacher(c.school_id)
          OR c.class_teacher_id = auth.uid()
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_class_attendance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_class_attendance(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_attendance_select" ON public.class_attendance;
CREATE POLICY "class_attendance_select"
  ON public.class_attendance
  FOR SELECT
  TO authenticated
  USING (public.can_manage_class_attendance(class_id));

DROP POLICY IF EXISTS "class_attendance_insert" ON public.class_attendance;
CREATE POLICY "class_attendance_insert"
  ON public.class_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_class_attendance(class_id)
    AND recorded_by = auth.uid()
  );

DROP POLICY IF EXISTS "class_attendance_update" ON public.class_attendance;
CREATE POLICY "class_attendance_update"
  ON public.class_attendance
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_class_attendance(class_id))
  WITH CHECK (public.can_manage_class_attendance(class_id));

DROP POLICY IF EXISTS "class_attendance_delete" ON public.class_attendance;
CREATE POLICY "class_attendance_delete"
  ON public.class_attendance
  FOR DELETE
  TO authenticated
  USING (public.can_manage_class_attendance(class_id));

DROP POLICY IF EXISTS "class_attendance_super_admin" ON public.class_attendance;
CREATE POLICY "class_attendance_super_admin"
  ON public.class_attendance
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.class_attendance TO authenticated;
GRANT ALL ON TABLE public.class_attendance TO service_role;
