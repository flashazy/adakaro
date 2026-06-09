-- Adakaro Health Center: persistent watchdog / health alerts for super admins.

CREATE TABLE IF NOT EXISTS public.health_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  feature text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  dedupe_key text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_alerts_status_last_seen
  ON public.health_alerts (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_alerts_school_id
  ON public.health_alerts (school_id);

CREATE INDEX IF NOT EXISTS idx_health_alerts_feature
  ON public.health_alerts (feature);

CREATE UNIQUE INDEX IF NOT EXISTS idx_health_alerts_dedupe_key
  ON public.health_alerts (dedupe_key);

CREATE TRIGGER health_alerts_updated_at
  BEFORE UPDATE ON public.health_alerts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.health_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "health_alerts_super_admin_all" ON public.health_alerts;
CREATE POLICY "health_alerts_super_admin_all"
  ON public.health_alerts
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

COMMENT ON TABLE public.health_alerts IS
  'Persistent Adakaro Health Center alerts. Written server-side only (service role).';

GRANT SELECT, UPDATE ON TABLE public.health_alerts TO authenticated;
GRANT ALL ON TABLE public.health_alerts TO service_role;
