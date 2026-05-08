-- Store an immutable "recorded by" snapshot on payments for auditability.
-- Fixes UI showing "Unknown (—)" when the recorder's profile row is missing later.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS recorded_by_name text,
  ADD COLUMN IF NOT EXISTS recorded_by_role text;

COMMENT ON COLUMN public.payments.recorded_by_name IS 'Snapshot of recorder full_name at record time (from profiles).';
COMMENT ON COLUMN public.payments.recorded_by_role IS 'Snapshot of recorder role at record time (from profiles.role).';

-- Trigger to ensure snapshot fields are set server-side (prevents spoofing).
CREATE OR REPLACE FUNCTION public.set_payment_recorded_by_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_role text;
BEGIN
  -- Prefer explicit recorded_by_id; otherwise default to current user (when available).
  IF NEW.recorded_by_id IS NULL THEN
    NEW.recorded_by_id := auth.uid();
  END IF;

  IF NEW.recorded_by_id IS NOT NULL THEN
    SELECT p.full_name::text, p.role::text
    INTO v_name, v_role
    FROM public.profiles p
    WHERE p.id = NEW.recorded_by_id;
  END IF;

  -- Always set from profiles lookup to avoid client-supplied spoofing.
  NEW.recorded_by_name := v_name;
  NEW.recorded_by_role := v_role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_set_recorded_by_snapshot ON public.payments;
CREATE TRIGGER payments_set_recorded_by_snapshot
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payment_recorded_by_snapshot();

-- Best-effort backfill: fill snapshots where we can still resolve the profile.
UPDATE public.payments p
SET
  recorded_by_name = pr.full_name::text,
  recorded_by_role = pr.role::text
FROM public.profiles pr
WHERE pr.id = p.recorded_by_id
  AND (p.recorded_by_name IS NULL OR p.recorded_by_role IS NULL);

