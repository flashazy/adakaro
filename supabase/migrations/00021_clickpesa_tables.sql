-- ClickPesa BillPay: tables + enum value (replaces AzamPay flow in app)

DO $do$
BEGIN
  ALTER TYPE public.payment_method ADD VALUE 'clickpesa';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;

CREATE TABLE IF NOT EXISTS public.clickpesa_fee_bills (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_structure_id uuid NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  parent_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  control_number   text NOT NULL,
  order_reference  text NOT NULL UNIQUE,
  amount           numeric(12, 2) NOT NULL CHECK (amount > 0),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clickpesa_bills_student ON public.clickpesa_fee_bills(student_id);
CREATE INDEX IF NOT EXISTS idx_clickpesa_bills_order_ref ON public.clickpesa_fee_bills(order_reference);

CREATE TABLE IF NOT EXISTS public.clickpesa_payment_transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clickpesa_bill_id  uuid NOT NULL REFERENCES public.clickpesa_fee_bills(id) ON DELETE CASCADE,
  payment_reference  text,
  amount             numeric(12, 2) NOT NULL,
  status             text NOT NULL DEFAULT 'success',
  raw_webhook        jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clickpesa_tx_bill ON public.clickpesa_payment_transactions(clickpesa_bill_id);

ALTER TABLE public.clickpesa_fee_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clickpesa_payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parents can view own ClickPesa bills" ON public.clickpesa_fee_bills;
DROP POLICY IF EXISTS "Parents can insert own ClickPesa bills" ON public.clickpesa_fee_bills;

CREATE POLICY "Parents can view own ClickPesa bills"
  ON public.clickpesa_fee_bills FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can insert own ClickPesa bills"
  ON public.clickpesa_fee_bills FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- Transactions are written only via service role (webhook); no policies for authenticated

GRANT SELECT, INSERT ON public.clickpesa_fee_bills TO authenticated;
GRANT ALL ON public.clickpesa_fee_bills TO service_role;
GRANT ALL ON public.clickpesa_payment_transactions TO service_role;
