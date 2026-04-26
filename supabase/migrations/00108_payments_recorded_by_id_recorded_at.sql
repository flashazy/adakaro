-- Align naming with app (recorded_by_id) and store exact time the payment was saved (recorded_at).

-- Rename existing recorder column (data preserved; same FK to profiles)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name = 'recorded_by'
  ) THEN
    ALTER TABLE public.payments RENAME COLUMN recorded_by TO recorded_by_id;
  END IF;
END
$$;

-- Rename index if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idx_payments_recorded_by'
  ) THEN
    ALTER INDEX public.idx_payments_recorded_by
      RENAME TO idx_payments_recorded_by_id;
  END IF;
END
$$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz;

UPDATE public.payments
SET recorded_at = created_at
WHERE recorded_at IS NULL;

UPDATE public.payments
SET recorded_at = now()
WHERE recorded_at IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN recorded_at SET NOT NULL;

ALTER TABLE public.payments
  ALTER COLUMN recorded_at SET DEFAULT now();

COMMENT ON COLUMN public.payments.recorded_by_id IS 'User (profiles.id) who saved this payment row.';
COMMENT ON COLUMN public.payments.recorded_at IS 'When the payment was recorded in the app (use school timezone in UI).';
