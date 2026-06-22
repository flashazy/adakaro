-- WhatsApp modal leads: request type + expanded public insert policy.

ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'demo';

ALTER TABLE public.demo_requests
  DROP CONSTRAINT IF EXISTS demo_requests_request_type_check;

ALTER TABLE public.demo_requests
  ADD CONSTRAINT demo_requests_request_type_check CHECK (
    request_type IN ('demo', 'support')
  );

ALTER TABLE public.demo_requests
  DROP CONSTRAINT IF EXISTS demo_requests_source_check;

ALTER TABLE public.demo_requests
  ADD CONSTRAINT demo_requests_source_check CHECK (
    source IN ('contact_page', 'whatsapp')
  );

DROP POLICY IF EXISTS "Public insert demo_requests" ON public.demo_requests;

CREATE POLICY "Public insert demo_requests"
  ON public.demo_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'New'
    AND source IN ('contact_page', 'whatsapp')
    AND request_type IN ('demo', 'support')
  );

CREATE INDEX IF NOT EXISTS demo_requests_source_idx
  ON public.demo_requests (source);

CREATE INDEX IF NOT EXISTS demo_requests_request_type_idx
  ON public.demo_requests (request_type);
