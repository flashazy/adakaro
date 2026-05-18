-- Daily duty book report: events, remarks, and head teacher sign-off.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS head_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.schools.head_teacher_id IS
  'Profile allowed to sign duty book reports for this school.';

CREATE INDEX IF NOT EXISTS idx_schools_head_teacher_id
  ON public.schools (head_teacher_id)
  WHERE head_teacher_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.duty_book_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  remarks text,
  head_teacher_signature text,
  head_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  signed_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_duty_book_reports_school_date
  ON public.duty_book_reports (school_id, report_date DESC);

COMMENT ON TABLE public.duty_book_reports IS
  'Official daily duty book: events, teacher remarks, head teacher approval.';
COMMENT ON COLUMN public.duty_book_reports.events IS
  'JSON array of { id, time, type, description } objects.';
COMMENT ON COLUMN public.duty_book_reports.head_teacher_signature IS
  'Signer display label at sign time (e.g. full name).';

DROP TRIGGER IF EXISTS duty_book_reports_updated_at ON public.duty_book_reports;
CREATE TRIGGER duty_book_reports_updated_at
  BEFORE UPDATE ON public.duty_book_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_school_head_teacher(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.schools s
    WHERE s.id = p_school_id
      AND s.head_teacher_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_school_head_teacher(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_head_teacher(uuid) TO authenticated;

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
    OR public.is_teacher_for_school(p_school_id)
    OR public.is_school_head_teacher(p_school_id)
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

CREATE OR REPLACE FUNCTION public.can_sign_duty_book_report(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.is_school_head_teacher(p_school_id)
    OR (
      public.is_school_admin(p_school_id)
      AND EXISTS (
        SELECT 1
        FROM public.schools s
        WHERE s.id = p_school_id
          AND s.head_teacher_id IS NULL
      )
    )
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

REVOKE ALL ON FUNCTION public.can_sign_duty_book_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_sign_duty_book_report(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.duty_book_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_book_reports_select" ON public.duty_book_reports;
CREATE POLICY "duty_book_reports_select"
  ON public.duty_book_reports
  FOR SELECT
  TO authenticated
  USING (public.can_view_duty_book(school_id));

DROP POLICY IF EXISTS "duty_book_reports_insert" ON public.duty_book_reports;
CREATE POLICY "duty_book_reports_insert"
  ON public.duty_book_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_view_duty_book(school_id)
    AND (
      public.is_school_admin(school_id)
      OR public.is_teacher_for_school(school_id)
    )
    AND created_by = auth.uid()
    AND signed_at IS NULL
  );

DROP POLICY IF EXISTS "duty_book_reports_update_unsigned" ON public.duty_book_reports;
CREATE POLICY "duty_book_reports_update_unsigned"
  ON public.duty_book_reports
  FOR UPDATE
  TO authenticated
  USING (
    signed_at IS NULL
    AND (
      public.is_school_admin(school_id)
      OR public.is_teacher_for_school(school_id)
    )
  )
  WITH CHECK (
    signed_at IS NULL
    AND (
      public.is_school_admin(school_id)
      OR public.is_teacher_for_school(school_id)
    )
  );

DROP POLICY IF EXISTS "duty_book_reports_sign" ON public.duty_book_reports;
CREATE POLICY "duty_book_reports_sign"
  ON public.duty_book_reports
  FOR UPDATE
  TO authenticated
  USING (
    signed_at IS NULL
    AND public.can_sign_duty_book_report(school_id)
  )
  WITH CHECK (
    signed_at IS NOT NULL
    AND head_teacher_id = auth.uid()
    AND public.can_sign_duty_book_report(school_id)
  );

DROP POLICY IF EXISTS "duty_book_reports_super_admin" ON public.duty_book_reports;
CREATE POLICY "duty_book_reports_super_admin"
  ON public.duty_book_reports
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE ON TABLE public.duty_book_reports TO authenticated;
GRANT ALL ON TABLE public.duty_book_reports TO service_role;
