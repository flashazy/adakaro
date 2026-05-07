-- Parents with a parent_students link should see the student on the dashboard
-- while enrollment is still pending approval (same as admission-based login).

DROP POLICY IF EXISTS "Parents can view linked students" ON public.students;
CREATE POLICY "Parents can view linked students"
  ON public.students FOR SELECT
  USING (
    id IN (SELECT public.parent_student_ids())
    AND approval_status IN ('approved', 'pending')
  );
