-- Phase 3: Coordinator promotion for teachers with an Academic department role.
-- Admins pick one or more classes and promote an Academic teacher to Class Coordinator
-- for those classes. Coordinators read/summarise their classes without affecting the
-- existing Academic department-role behaviour. A single teacher can coordinate many
-- classes; each (teacher, class) pair is unique.

-- ---------------------------------------------------------------------------
-- teacher_coordinators
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_coordinators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_coordinators_school
  ON public.teacher_coordinators (school_id);

CREATE INDEX IF NOT EXISTS idx_teacher_coordinators_teacher
  ON public.teacher_coordinators (teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_coordinators_class
  ON public.teacher_coordinators (class_id);

DROP TRIGGER IF EXISTS teacher_coordinators_updated_at
  ON public.teacher_coordinators;
CREATE TRIGGER teacher_coordinators_updated_at
  BEFORE UPDATE ON public.teacher_coordinators
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_coordinators ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: is_class_coordinator
-- Returns true when the current auth user is a coordinator for the given class.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_class_coordinator(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_coordinators c
    WHERE c.class_id = p_class_id
      AND c.teacher_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_class_coordinator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_class_coordinator(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- Teachers can read their own coordinator rows. Admins of the school (and
-- super admins) can read every row for that school.
DROP POLICY IF EXISTS "teacher_coordinators_select"
  ON public.teacher_coordinators;
CREATE POLICY "teacher_coordinators_select"
  ON public.teacher_coordinators FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

-- Only school admins (or super admins) may insert / update / delete rows.
DROP POLICY IF EXISTS "teacher_coordinators_insert_admin"
  ON public.teacher_coordinators;
CREATE POLICY "teacher_coordinators_insert_admin"
  ON public.teacher_coordinators FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_school_admin(school_id) OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "teacher_coordinators_update_admin"
  ON public.teacher_coordinators;
CREATE POLICY "teacher_coordinators_update_admin"
  ON public.teacher_coordinators FOR UPDATE
  TO authenticated
  USING (
    public.is_school_admin(school_id) OR public.is_super_admin()
  )
  WITH CHECK (
    public.is_school_admin(school_id) OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "teacher_coordinators_delete_admin"
  ON public.teacher_coordinators;
CREATE POLICY "teacher_coordinators_delete_admin"
  ON public.teacher_coordinators FOR DELETE
  TO authenticated
  USING (
    public.is_school_admin(school_id) OR public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_coordinators TO authenticated;
GRANT ALL ON public.teacher_coordinators TO service_role;
