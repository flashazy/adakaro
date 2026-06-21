-- CRM enhancements: lead owner, won reason, expanded lost reasons.

ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS assigned_to_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_name text,
  ADD COLUMN IF NOT EXISTS won_reason text;

ALTER TABLE public.demo_requests
  DROP CONSTRAINT IF EXISTS demo_requests_lost_reason_check;

ALTER TABLE public.demo_requests
  ADD CONSTRAINT demo_requests_lost_reason_check CHECK (
    lost_reason IS NULL
    OR lost_reason IN (
      'Too expensive',
      'No budget',
      'Using another system',
      'No decision maker',
      'No response',
      'Not interested',
      'Other',
      'Using competitor',
      'Not a fit'
    )
  );

ALTER TABLE public.demo_requests
  DROP CONSTRAINT IF EXISTS demo_requests_won_reason_check;

ALTER TABLE public.demo_requests
  ADD CONSTRAINT demo_requests_won_reason_check CHECK (
    won_reason IS NULL
    OR won_reason IN (
      'Good fit',
      'Needed report cards',
      'Needed finance management',
      'Needed student management',
      'Recommended by another school',
      'Other'
    )
  );

CREATE INDEX IF NOT EXISTS demo_requests_assigned_to_id_idx
  ON public.demo_requests (assigned_to_id);
