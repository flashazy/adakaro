-- Allow parents to read attendance rows for their linked students (e.g. report card view).

CREATE POLICY "teacher_attendance_parent_select"
  ON public.teacher_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_students ps
      WHERE ps.parent_id = auth.uid()
        AND ps.student_id = teacher_attendance.student_id
    )
  );
