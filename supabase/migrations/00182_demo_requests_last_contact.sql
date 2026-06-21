-- Track last outreach for sales command center KPIs.

ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_demo_requests_last_contact_at
  ON public.demo_requests (last_contact_at DESC NULLS LAST);
