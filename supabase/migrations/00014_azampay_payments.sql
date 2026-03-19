-- ============================================================
-- AzamPay online payments support
-- ============================================================

-- Add 'azampay' to payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'azampay';

-- Table to track pending AzamPay payments (webhook looks up by external_id)
CREATE TABLE IF NOT EXISTS public.azampay_pending_payments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id      text        NOT NULL UNIQUE,
  student_id       uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_structure_id uuid        NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  amount           numeric(12, 2) NOT NULL CHECK (amount > 0),
  parent_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_azampay_pending_external ON public.azampay_pending_payments(external_id);

ALTER TABLE public.azampay_pending_payments ENABLE ROW LEVEL SECURITY;

-- Parents can insert their own pending payments
CREATE POLICY "Parents can insert own pending"
  ON public.azampay_pending_payments FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- Service role (webhook) bypasses RLS; no additional policies needed
GRANT ALL ON public.azampay_pending_payments TO authenticated;
GRANT ALL ON public.azampay_pending_payments TO service_role;
