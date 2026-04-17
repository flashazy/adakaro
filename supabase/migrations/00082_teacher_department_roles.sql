-- Phase 2: Department roles for teachers.
-- Admins assign teachers to departments (academic, discipline, health, finance).
-- Department roles drive which tabs non-admin users can see on student profiles.
-- Admins always see everything; department users can only view their section(s).

-- ---------------------------------------------------------------------------
-- teacher_department_roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_department_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department text NOT NULL CHECK (department IN ('academic', 'discipline', 'health', 'finance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, department)
);

CREATE INDEX IF NOT EXISTS idx_teacher_department_roles_school_user
  ON public.teacher_department_roles (school_id, user_id);

CREATE INDEX IF NOT EXISTS idx_teacher_department_roles_user
  ON public.teacher_department_roles (user_id);

DROP TRIGGER IF EXISTS teacher_department_roles_updated_at
  ON public.teacher_department_roles;
CREATE TRIGGER teacher_department_roles_updated_at
  BEFORE UPDATE ON public.teacher_department_roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_department_roles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: has_teacher_department_role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_teacher_department_role(
  p_school_id uuid,
  p_department text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_department_roles r
    WHERE r.school_id = p_school_id
      AND r.user_id = auth.uid()
      AND r.department = p_department
  );
$$;

REVOKE ALL ON FUNCTION public.has_teacher_department_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_teacher_department_role(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "teacher_department_roles_select"
  ON public.teacher_department_roles;
CREATE POLICY "teacher_department_roles_select"
  ON public.teacher_department_roles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "teacher_department_roles_insert_admin"
  ON public.teacher_department_roles;
CREATE POLICY "teacher_department_roles_insert_admin"
  ON public.teacher_department_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "teacher_department_roles_update_admin"
  ON public.teacher_department_roles;
CREATE POLICY "teacher_department_roles_update_admin"
  ON public.teacher_department_roles FOR UPDATE
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "teacher_department_roles_delete_admin"
  ON public.teacher_department_roles;
CREATE POLICY "teacher_department_roles_delete_admin"
  ON public.teacher_department_roles FOR DELETE
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_department_roles TO authenticated;
GRANT ALL ON public.teacher_department_roles TO service_role;
