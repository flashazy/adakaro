-- Adakaro Copilot controlled rollout.
-- Adds a per-school availability flag, defaulting to FALSE for every school.
-- Only platform super admins may change this flag (enforced via trigger).

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS copilot_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.schools.copilot_enabled IS
  'Adakaro Copilot availability for this school. Only super admins can change it. Default false (private rollout).';

-- ── Guard: only super admins (or service role) may flip copilot_enabled ──────
CREATE OR REPLACE FUNCTION public.guard_school_copilot_enabled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.copilot_enabled IS DISTINCT FROM OLD.copilot_enabled) THEN
    -- Service-role / server-side calls have no auth.uid(); allow those.
    -- Authenticated end users must be platform super admins.
    IF auth.uid() IS NOT NULL AND COALESCE(public.is_super_admin(), false) = false THEN
      RAISE EXCEPTION 'Only super admins can change copilot_enabled';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schools_guard_copilot_enabled ON public.schools;
CREATE TRIGGER schools_guard_copilot_enabled
  BEFORE UPDATE OF copilot_enabled ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_school_copilot_enabled();

-- ── Private testing rollout: enable Copilot for Mount Zion only ──────────────
UPDATE public.schools
SET copilot_enabled = true
WHERE id = '23856e53-99a4-45ec-b621-76b13cfe6eb4'
   OR lower(trim(name)) = lower('Mount zion primary school');
