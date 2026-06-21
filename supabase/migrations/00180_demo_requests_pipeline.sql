-- Demo requests sales pipeline: follow-ups, scheduling, notes, timeline, super-admin alerts.

ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_date date,
  ADD COLUMN IF NOT EXISTS demo_date date,
  ADD COLUMN IF NOT EXISTS demo_time time,
  ADD COLUMN IF NOT EXISTS meeting_link text;

CREATE TABLE IF NOT EXISTS public.demo_request_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_request_id uuid NOT NULL REFERENCES public.demo_requests(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_request_notes_request
  ON public.demo_request_notes (demo_request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.demo_request_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_request_id uuid NOT NULL REFERENCES public.demo_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  label text NOT NULL,
  detail text,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_request_timeline
  ON public.demo_request_timeline_events (demo_request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.super_admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'demo_request',
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_notifications_recipient
  ON public.super_admin_notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_admin_notifications_unread
  ON public.super_admin_notifications (recipient_id)
  WHERE read_at IS NULL;

ALTER TABLE public.demo_request_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_request_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins demo_request_notes" ON public.demo_request_notes;
CREATE POLICY "Super admins demo_request_notes"
  ON public.demo_request_notes FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins demo_request_timeline" ON public.demo_request_timeline_events;
CREATE POLICY "Super admins demo_request_timeline"
  ON public.demo_request_timeline_events FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins read own notifications" ON public.super_admin_notifications;
CREATE POLICY "Super admins read own notifications"
  ON public.super_admin_notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid() AND public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update own notifications" ON public.super_admin_notifications;
CREATE POLICY "Super admins update own notifications"
  ON public.super_admin_notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid() AND public.is_super_admin())
  WITH CHECK (recipient_id = auth.uid() AND public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_request_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_request_timeline_events TO authenticated;
GRANT SELECT, UPDATE ON public.super_admin_notifications TO authenticated;
GRANT ALL ON public.demo_request_notes TO service_role;
GRANT ALL ON public.demo_request_timeline_events TO service_role;
GRANT ALL ON public.super_admin_notifications TO service_role;

COMMENT ON TABLE public.demo_request_notes IS
  'Internal notes on inbound demo leads. Super Admin only.';
COMMENT ON TABLE public.demo_request_timeline_events IS
  'Activity timeline for demo lead pipeline. Super Admin only.';
COMMENT ON TABLE public.super_admin_notifications IS
  'Platform-level in-app alerts for super admins (e.g. new demo requests).';
