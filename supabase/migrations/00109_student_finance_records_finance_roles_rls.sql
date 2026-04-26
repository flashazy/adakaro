-- Allow school finance/accounts staff (not only is_school_admin) to add/edit term finance snapshots
-- (matches app permission: admin, profiles.role finance|accounts, or teacher_department finance|accounts).

CREATE OR REPLACE FUNCTION public.student_finance_record_editor_for_student(
  p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = p_student_id
      AND (
        public.is_school_admin(s.school_id)
        OR public.is_super_admin()
        OR public.has_teacher_department_role(s.school_id, 'finance')
        OR public.has_teacher_department_role(s.school_id, 'accounts')
        OR (
          EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = ANY (ARRAY['finance', 'accounts']::public.user_role[])
          )
          AND EXISTS (
            SELECT 1
            FROM public.school_members sm
            WHERE sm.school_id = s.school_id
              AND sm.user_id = auth.uid()
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.student_finance_record_editor_for_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_finance_record_editor_for_student(uuid) TO authenticated;

DROP POLICY IF EXISTS "student_finance_records_insert_admin" ON public.student_finance_records;
CREATE POLICY "student_finance_records_insert_admin"
  ON public.student_finance_records FOR INSERT
  WITH CHECK (public.student_finance_record_editor_for_student(student_id));

DROP POLICY IF EXISTS "student_finance_records_update_admin" ON public.student_finance_records;
CREATE POLICY "student_finance_records_update_admin"
  ON public.student_finance_records FOR UPDATE
  USING (public.student_finance_record_editor_for_student(student_id))
  WITH CHECK (public.student_finance_record_editor_for_student(student_id));

DROP POLICY IF EXISTS "student_finance_records_delete_admin" ON public.student_finance_records;
CREATE POLICY "student_finance_records_delete_admin"
  ON public.student_finance_records FOR DELETE
  USING (public.student_finance_record_editor_for_student(student_id));
