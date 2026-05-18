-- Fix schools stored with legacy "paid" plan label or stale free-tier caps.

-- Normalize legacy paid aliases to basic (canonical cheapest paid tier).
UPDATE public.schools
SET
  plan = 'basic',
  updated_at = now()
WHERE lower(trim(coalesce(plan, ''))) IN ('paid', 'premium', 'plus', 'standard', 'starter');

-- Any non-free plan must have unlimited caps (NULL).
UPDATE public.schools
SET
  student_limit = NULL,
  admin_limit = NULL,
  updated_at = now()
WHERE lower(trim(coalesce(plan, 'free'))) <> 'free'
  AND (student_limit IS NOT NULL OR admin_limit IS NOT NULL);

-- Keep limits in sync when plan uses legacy "paid" label.
CREATE OR REPLACE FUNCTION public.sync_school_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p text;
BEGIN
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.plan IS DISTINCT FROM OLD.plan) THEN
    p := lower(trim(coalesce(NEW.plan, 'free')));
    IF p = 'free' THEN
      NEW.student_limit := 20;
      NEW.admin_limit := 1;
    ELSE
      NEW.student_limit := NULL;
      NEW.admin_limit := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
