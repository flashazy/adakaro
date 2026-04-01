-- Tracks ClickPesa orders for suspended-school reactivation (webhook activates school).

CREATE TABLE IF NOT EXISTS public.school_reactivation_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  order_reference text NOT NULL UNIQUE,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed')),
  control_number text,
  checkout_link text,
  payment_reference text,
  paid_at timestamptz,
  raw_webhook_last jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_reactivation_bills_order
  ON public.school_reactivation_bills (order_reference);

CREATE INDEX IF NOT EXISTS idx_school_reactivation_bills_school
  ON public.school_reactivation_bills (school_id);

ALTER TABLE public.school_reactivation_bills ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.school_reactivation_bills IS
  'ClickPesa BillPay/checkout orders to reactivate suspended schools; webhook marks paid and sets schools.status = active.';

GRANT ALL ON TABLE public.school_reactivation_bills TO service_role;
