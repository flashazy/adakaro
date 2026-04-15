-- Fixes: infinite recursion detected in policy for relation "profiles" (42P17)
-- when selecting student_subject_enrollment after 00072.
--
-- Causes: (1) Policies on enrollment use EXISTS (SELECT … FROM students …).
--         Checking students re-runs student RLS, which calls is_super_admin() /
--         nested helpers; if helpers read profiles without bypassing RLS, the
--         "Super admins select all profiles" policy re-enters profiles.
--         (2) is_school_admin / user_school_ids without row_security=off can
--         amplify nested policy checks.
--
-- Idempotent: safe to run on DBs that already have 00048 / correct helpers.

-- ---------------------------------------------------------------------------
-- 1) Re-assert profile helper functions (same as 00048)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'::public.user_role
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'teacher'::public.user_role
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) School helpers: bypass RLS while resolving membership (same logic as 00020)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_school_role(p_school_id uuid)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
  SELECT COALESCE(
    (
      SELECT sm.role FROM public.school_members sm
      WHERE sm.school_id = p_school_id AND sm.user_id = auth.uid()
      LIMIT 1
    ),
    (
      SELECT 'admin'::public.user_role
      FROM public.schools s
      WHERE s.id = p_school_id AND s.created_by = auth.uid()
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_members
    WHERE school_id = p_school_id
      AND user_id = auth.uid()
      AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = p_school_id AND s.created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_school_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
  SELECT school_id FROM public.school_members WHERE user_id = auth.uid()
  UNION
  SELECT s.id FROM public.schools s WHERE s.created_by = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 3) Enrollment visibility without re-entering students RLS from policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sse_school_admin_can_see_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students st
    WHERE st.id = p_student_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.school_members sm
          WHERE sm.school_id = st.school_id
            AND sm.user_id = auth.uid()
            AND sm.role = 'admin'
        )
        OR EXISTS (
          SELECT 1
          FROM public.schools s
          WHERE s.id = st.school_id
            AND s.created_by = auth.uid()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.sse_school_admin_can_see_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sse_school_admin_can_see_student(uuid) TO authenticated;

COMMENT ON FUNCTION public.sse_school_admin_can_see_student(uuid) IS
  'True if auth user is school admin (or founding creator) for the student''s school. SECURITY DEFINER + row_security=off so enrollment RLS does not recurse through students/profiles.';

CREATE OR REPLACE FUNCTION public.sse_student_belongs_to_class(
  p_student_id uuid,
  p_class_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students st
    WHERE st.id = p_student_id AND st.class_id = p_class_id
  );
$$;

REVOKE ALL ON FUNCTION public.sse_student_belongs_to_class(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sse_student_belongs_to_class(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "student_subject_enrollment_select_admin" ON public.student_subject_enrollment;
CREATE POLICY "student_subject_enrollment_select_admin"
  ON public.student_subject_enrollment FOR SELECT
  USING (public.sse_school_admin_can_see_student(student_id));

DROP POLICY IF EXISTS "student_subject_enrollment_insert_admin" ON public.student_subject_enrollment;
CREATE POLICY "student_subject_enrollment_insert_admin"
  ON public.student_subject_enrollment FOR INSERT
  WITH CHECK (
    (
      public.sse_school_admin_can_see_student(student_id)
      AND public.sse_student_belongs_to_class(student_id, class_id)
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "student_subject_enrollment_update_admin" ON public.student_subject_enrollment;
CREATE POLICY "student_subject_enrollment_update_admin"
  ON public.student_subject_enrollment FOR UPDATE
  USING (
    public.sse_school_admin_can_see_student(student_id)
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      public.sse_school_admin_can_see_student(student_id)
      AND public.sse_student_belongs_to_class(student_id, class_id)
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "student_subject_enrollment_delete_admin" ON public.student_subject_enrollment;
CREATE POLICY "student_subject_enrollment_delete_admin"
  ON public.student_subject_enrollment FOR DELETE
  USING (
    public.sse_school_admin_can_see_student(student_id)
    OR public.is_super_admin()
  );
