-- Fix grants and RLS for student_attendance_status (class teacher write, subject teacher read).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_attendance_status TO authenticated;

DROP POLICY IF EXISTS "student_attendance_status_select" ON public.student_attendance_status;
DROP POLICY IF EXISTS "student_attendance_status_class_teacher_write" ON public.student_attendance_status;
DROP POLICY IF EXISTS "student_attendance_status_class_teacher_insert" ON public.student_attendance_status;
DROP POLICY IF EXISTS "student_attendance_status_class_teacher_update" ON public.student_attendance_status;
DROP POLICY IF EXISTS "student_attendance_status_class_teacher_delete" ON public.student_attendance_status;
DROP POLICY IF EXISTS "student_attendance_status_admin_all" ON public.student_attendance_status;
DROP POLICY IF EXISTS "student_attendance_status_super_admin" ON public.student_attendance_status;
DROP POLICY IF EXISTS "Class teachers can manage attendance status" ON public.student_attendance_status;
DROP POLICY IF EXISTS "Subject teachers can view attendance status" ON public.student_attendance_status;

-- Read: class teachers, subject teachers assigned to the student's class, school admins, super admins.
CREATE POLICY "student_attendance_status_select"
  ON public.student_attendance_status
  FOR SELECT
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

-- Class teacher: insert / update / delete for students in their class.
CREATE POLICY "student_attendance_status_class_teacher_insert"
  ON public.student_attendance_status
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_class_teacher_for_student(student_id)
    AND marked_by = auth.uid()
  );

CREATE POLICY "student_attendance_status_class_teacher_update"
  ON public.student_attendance_status
  FOR UPDATE
  TO authenticated
  USING (public.is_class_teacher_for_student(student_id))
  WITH CHECK (
    public.is_class_teacher_for_student(student_id)
    AND marked_by = auth.uid()
  );

CREATE POLICY "student_attendance_status_class_teacher_delete"
  ON public.student_attendance_status
  FOR DELETE
  TO authenticated
  USING (public.is_class_teacher_for_student(student_id));

-- School admins: full access for students in their school.
CREATE POLICY "student_attendance_status_admin_all"
  ON public.student_attendance_status
  FOR ALL
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
  ON public.student_attendance_status
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
