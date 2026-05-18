-- Teacher on Duty (TOD): temporary duty book access by date range.

CREATE TABLE IF NOT EXISTS public.teacher_duty_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_duty_assignments_end_after_start CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_duty_assignments_school_id
  ON public.teacher_duty_assignments (school_id);

CREATE INDEX IF NOT EXISTS idx_teacher_duty_assignments_teacher_id
  ON public.teacher_duty_assignments (teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_duty_assignments_start_date
  ON public.teacher_duty_assignments (school_id, start_date);

CREATE INDEX IF NOT EXISTS idx_teacher_duty_assignments_end_date
  ON public.teacher_duty_assignments (school_id, end_date);

COMMENT ON TABLE public.teacher_duty_assignments IS
  'Temporary Teacher on Duty rotation; grants duty book access between start_date and end_date.';

DROP TRIGGER IF EXISTS teacher_duty_assignments_updated_at ON public.teacher_duty_assignments;
CREATE TRIGGER teacher_duty_assignments_updated_at
  BEFORE UPDATE ON public.teacher_duty_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_teacher_on_duty(
  p_school_id uuid,
  p_teacher_id uuid DEFAULT auth.uid(),
  p_on_date date DEFAULT CURRENT_DATE
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
    FROM public.teacher_duty_assignments tda
    WHERE tda.school_id = p_school_id
      AND tda.teacher_id = p_teacher_id
      AND tda.is_active = true
      AND tda.revoked_at IS NULL
      AND p_on_date BETWEEN tda.start_date AND tda.end_date
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_on_duty(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_on_duty(uuid, uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_duty_book(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.is_school_admin(p_school_id)
    OR public.is_school_head_teacher(p_school_id)
    OR public.is_teacher_on_duty(p_school_id, auth.uid(), CURRENT_DATE)
    OR (
      to_regclass('public.profiles') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'super_admin'::public.user_role
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_duty_book(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_duty_book(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.teacher_duty_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_duty_assignments_select" ON public.teacher_duty_assignments;
CREATE POLICY "teacher_duty_assignments_select"
  ON public.teacher_duty_assignments
  FOR SELECT
  TO authenticated
  USING (
    public.is_school_admin(school_id)
    OR public.is_teacher_on_duty(school_id, auth.uid(), CURRENT_DATE)
    OR teacher_id = auth.uid()
  );

DROP POLICY IF EXISTS "teacher_duty_assignments_insert" ON public.teacher_duty_assignments;
CREATE POLICY "teacher_duty_assignments_insert"
  ON public.teacher_duty_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_admin(school_id));

DROP POLICY IF EXISTS "teacher_duty_assignments_update" ON public.teacher_duty_assignments;
CREATE POLICY "teacher_duty_assignments_update"
  ON public.teacher_duty_assignments
  FOR UPDATE
  TO authenticated
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));

DROP POLICY IF EXISTS "teacher_duty_assignments_super_admin" ON public.teacher_duty_assignments;
CREATE POLICY "teacher_duty_assignments_super_admin"
  ON public.teacher_duty_assignments
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE ON TABLE public.teacher_duty_assignments TO authenticated;
GRANT ALL ON TABLE public.teacher_duty_assignments TO service_role;
