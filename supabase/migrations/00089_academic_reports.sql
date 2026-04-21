-- Academic Performance Reports: auto-generated when coordinators run Generate Report Cards.
-- Stored JSON mirrors dashboards for academic department staff; writers use service role only.

CREATE TABLE IF NOT EXISTS public.academic_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  term text NOT NULL CHECK (term IN ('Term 1', 'Term 2')),
  academic_year text NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, class_id, term, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_academic_reports_school_term_year
  ON public.academic_reports (school_id, academic_year, term);

CREATE INDEX IF NOT EXISTS idx_academic_reports_class
  ON public.academic_reports (class_id);

DROP TRIGGER IF EXISTS academic_reports_updated_at ON public.academic_reports;
CREATE TRIGGER academic_reports_updated_at
  BEFORE UPDATE ON public.academic_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.academic_reports ENABLE ROW LEVEL SECURITY;

-- Inserts/updates only via service role (coordinator server action uses admin client).
-- Authenticated readers: school admins, super admins, academic department teachers.

DROP POLICY IF EXISTS "academic_reports_select_authorized"
  ON public.academic_reports;
CREATE POLICY "academic_reports_select_authorized"
  ON public.academic_reports FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
  );

REVOKE INSERT, UPDATE, DELETE ON public.academic_reports FROM authenticated;
GRANT SELECT ON public.academic_reports TO authenticated;
GRANT ALL ON public.academic_reports TO service_role;
