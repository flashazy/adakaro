-- Super admin scheduled analytics / export email preferences (singleton row expected).

CREATE TABLE IF NOT EXISTS public.admin_report_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  frequency text CHECK (frequency IS NULL OR frequency IN ('weekly', 'monthly')),
  day_of_week integer CHECK (
    day_of_week IS NULL OR (day_of_week >= 1 AND day_of_week <= 7)
  ),
  day_of_month integer CHECK (
    day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)
  ),
  recipients text[] NOT NULL DEFAULT '{}'::text[],
  export_to_email_enabled boolean NOT NULL DEFAULT false,
  last_sent timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_report_preferences IS
  'Email report schedule for super admins; typically one row.';

DROP TRIGGER IF EXISTS admin_report_preferences_updated_at
  ON public.admin_report_preferences;
CREATE TRIGGER admin_report_preferences_updated_at
  BEFORE UPDATE ON public.admin_report_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_admin_report_preferences_enabled
  ON public.admin_report_preferences (enabled)
  WHERE enabled = true;

ALTER TABLE public.admin_report_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage report preferences"
  ON public.admin_report_preferences
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_report_preferences TO authenticated;
