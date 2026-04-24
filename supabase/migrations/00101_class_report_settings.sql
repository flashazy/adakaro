-- Per-class report card extras: term dates, coordinator message, required items.

CREATE TABLE public.class_report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  term text NOT NULL,
  academic_year integer NOT NULL,
  closing_date date,
  opening_date date,
  coordinator_message text,
  required_items text[],
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_report_settings_class_term_year_unique UNIQUE (class_id, term, academic_year)
);

CREATE INDEX idx_class_report_settings_class
  ON public.class_report_settings (class_id);

DROP TRIGGER IF EXISTS class_report_settings_updated_at ON public.class_report_settings;
CREATE TRIGGER class_report_settings_updated_at
  BEFORE UPDATE ON public.class_report_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.class_report_settings ENABLE ROW LEVEL SECURITY;

-- Coordinators and school admins manage settings for their class / school.
DROP POLICY IF EXISTS "class_report_settings_select" ON public.class_report_settings;
CREATE POLICY "class_report_settings_select"
  ON public.class_report_settings FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_class_coordinator(class_id)
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_report_settings.class_id
        AND public.is_school_admin(c.school_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.parent_students ps ON ps.student_id = s.id
      WHERE ps.parent_id = auth.uid()
        AND s.class_id = class_report_settings.class_id
    )
  );

DROP POLICY IF EXISTS "class_report_settings_insert" ON public.class_report_settings;
CREATE POLICY "class_report_settings_insert"
  ON public.class_report_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.is_class_coordinator(class_id)
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_report_settings.class_id
        AND public.is_school_admin(c.school_id)
    )
  );

DROP POLICY IF EXISTS "class_report_settings_update" ON public.class_report_settings;
CREATE POLICY "class_report_settings_update"
  ON public.class_report_settings FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_class_coordinator(class_id)
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_report_settings.class_id
        AND public.is_school_admin(c.school_id)
    )
  );

DROP POLICY IF EXISTS "class_report_settings_delete" ON public.class_report_settings;
CREATE POLICY "class_report_settings_delete"
  ON public.class_report_settings FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_class_coordinator(class_id)
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_report_settings.class_id
        AND public.is_school_admin(c.school_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_report_settings TO authenticated;
GRANT ALL ON public.class_report_settings TO service_role;

COMMENT ON TABLE public.class_report_settings IS
  'Coordinator-editable report card footer: reopening dates, message, and required items; keyed by class, term, and enrolment academic year.';
