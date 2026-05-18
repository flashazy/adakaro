-- Class-teacher health / excused absence flags (web). One active row per student.

CREATE TABLE public.student_attendance_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('ill', 'permitted')),
  marked_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  marked_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_attendance_status_student_id_key UNIQUE (student_id)
);

CREATE INDEX idx_student_attendance_status_student
  ON public.student_attendance_status (student_id);

CREATE INDEX idx_student_attendance_status_marked_by
  ON public.student_attendance_status (marked_by);

CREATE TRIGGER student_attendance_status_updated_at
  BEFORE UPDATE ON public.student_attendance_status
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.is_class_teacher_for_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    INNER JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = p_student_id
      AND c.class_teacher_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_class_teacher_for_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_class_teacher_for_student(uuid) TO authenticated;

ALTER TABLE public.student_attendance_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_attendance_status_select"
  ON public.student_attendance_status FOR SELECT
  TO authenticated
  USING (
    public.is_class_teacher_for_student(student_id)
    OR EXISTS (
      SELECT 1
      FROM public.students s
      INNER JOIN public.teacher_assignments ta ON ta.class_id = s.class_id
      WHERE s.id = student_attendance_status.student_id
        AND ta.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_attendance_status.student_id
        AND public.is_school_admin(s.school_id)
    )
    OR public.is_super_admin()
  );

CREATE POLICY "student_attendance_status_class_teacher_write"
  ON public.student_attendance_status FOR ALL
  TO authenticated
  USING (public.is_class_teacher_for_student(student_id))
  WITH CHECK (
    public.is_class_teacher_for_student(student_id)
    AND marked_by = auth.uid()
  );

CREATE POLICY "student_attendance_status_admin_all"
  ON public.student_attendance_status FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_attendance_status.student_id
        AND public.is_school_admin(s.school_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_attendance_status.student_id
        AND public.is_school_admin(s.school_id)
    )
  );

CREATE POLICY "student_attendance_status_super_admin"
  ON public.student_attendance_status FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
