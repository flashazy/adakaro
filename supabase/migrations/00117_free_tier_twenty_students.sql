-- New tier model:
--   * Free  → max 20 students, 1 admin
--   * Any paid plan (basic / pro / enterprise) → unlimited (NULL)
--
-- Replaces the per-tier student/admin caps (50 / 200 / 500 / NULL) introduced in
-- migration 00036. The application gate now treats *any* non-free plan as
-- "paid + unlimited"; super-admin approval on an upgrade request flips a
-- school from `free` to `basic` (or higher) which removes the cap.

-- 1. Trigger: keep schools.student_limit / admin_limit in sync with new caps.
CREATE OR REPLACE FUNCTION public.sync_school_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.plan IS DISTINCT FROM OLD.plan) THEN
    IF lower(trim(coalesce(NEW.plan, 'free'))) = 'free' THEN
      NEW.student_limit := 20;
      NEW.admin_limit := 1;
    ELSE
      -- All paid plans are unlimited under the new model.
      NEW.student_limit := NULL;
      NEW.admin_limit := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Backfill existing rows so the new caps apply immediately.
UPDATE public.schools
SET
  student_limit = CASE
    WHEN lower(trim(coalesce(plan, 'free'))) = 'free' THEN 20
    ELSE NULL
  END,
  admin_limit = CASE
    WHEN lower(trim(coalesce(plan, 'free'))) = 'free' THEN 1
    ELSE NULL
  END;

COMMENT ON COLUMN public.schools.student_limit IS
  'Max students for this school; 20 for free plan, NULL = unlimited (any paid plan).';
COMMENT ON COLUMN public.schools.admin_limit IS
  'Max admin seats for this school; 1 for free plan, NULL = unlimited (any paid plan).';

COMMENT ON FUNCTION public.sync_school_plan_limits() IS
  'Free plan = 20 students / 1 admin. Any paid plan = unlimited. Runs BEFORE INSERT or UPDATE OF plan on schools.';
