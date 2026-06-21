-- Lost reason for demo lead pipeline analytics.

ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS lost_reason text;

ALTER TABLE public.demo_requests
  DROP CONSTRAINT IF EXISTS demo_requests_lost_reason_check;

ALTER TABLE public.demo_requests
  ADD CONSTRAINT demo_requests_lost_reason_check CHECK (
    lost_reason IS NULL
    OR lost_reason IN (
      'Too expensive',
      'No budget',
      'Using competitor',
      'No response',
      'Not a fit',
      'Other'
    )
  );
