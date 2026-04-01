-- Append-only audit log for admin and super-admin actions (service role only).

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  user_email text NOT NULL DEFAULT '',
  user_role public.user_role NOT NULL
    CHECK (user_role = ANY (ARRAY['admin'::public.user_role, 'super_admin'::public.user_role])),
  school_id uuid REFERENCES public.schools (id) ON DELETE SET NULL,
  action text NOT NULL,
  action_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_user_id
  ON public.admin_activity_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_school_id
  ON public.admin_activity_logs (school_id);

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action
  ON public.admin_activity_logs (action);

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at
  ON public.admin_activity_logs (created_at DESC);

COMMENT ON TABLE public.admin_activity_logs IS
  'Audit trail for school admin and super-admin actions; insert/select via service role only.';

ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- No policies: authenticated role cannot read/write. Service role bypasses RLS.

REVOKE ALL ON public.admin_activity_logs FROM PUBLIC;
REVOKE ALL ON public.admin_activity_logs FROM anon;
REVOKE ALL ON public.admin_activity_logs FROM authenticated;

GRANT SELECT, INSERT ON public.admin_activity_logs TO service_role;

-- Append-only: service role cannot update or delete rows
REVOKE UPDATE, DELETE ON public.admin_activity_logs FROM service_role;
