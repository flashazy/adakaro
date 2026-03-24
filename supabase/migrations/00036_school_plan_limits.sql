-- Denormalized plan limits + expiry; keep schools.plan as source of truth for tier name.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS student_limit integer,
  ADD COLUMN IF NOT EXISTS admin_limit integer;

-- One-time sync from current plan text (before trigger).
UPDATE public.schools s
SET
  student_limit = CASE lower(trim(s.plan))
    WHEN 'basic' THEN 200
    WHEN 'pro' THEN 500
    WHEN 'enterprise' THEN NULL
    ELSE 50
  END,
  admin_limit = CASE lower(trim(s.plan))
    WHEN 'basic' THEN 2
    WHEN 'pro' THEN 5
    WHEN 'enterprise' THEN NULL
    ELSE 1
  END;

-- Infer plan tier for schools still on free (by student count).
WITH counts AS (
  SELECT sc.id AS school_id, COUNT(st.id)::integer AS c
  FROM public.schools sc
  LEFT JOIN public.students st ON st.school_id = sc.id
  GROUP BY sc.id
)
UPDATE public.schools s
SET plan = CASE
  WHEN c.c <= 50 THEN 'free'
  WHEN c.c <= 200 THEN 'basic'
  WHEN c.c <= 500 THEN 'pro'
  ELSE 'enterprise'
END
FROM counts c
WHERE s.id = c.school_id
  AND lower(trim(coalesce(s.plan, 'free'))) = 'free';

-- Re-sync limits after possible plan bump.
UPDATE public.schools s
SET
  student_limit = CASE lower(trim(s.plan))
    WHEN 'basic' THEN 200
    WHEN 'pro' THEN 500
    WHEN 'enterprise' THEN NULL
    ELSE 50
  END,
  admin_limit = CASE lower(trim(s.plan))
    WHEN 'basic' THEN 2
    WHEN 'pro' THEN 5
    WHEN 'enterprise' THEN NULL
    ELSE 1
  END;

CREATE OR REPLACE FUNCTION public.sync_school_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.plan IS DISTINCT FROM OLD.plan) THEN
    NEW.student_limit := CASE lower(trim(NEW.plan))
      WHEN 'basic' THEN 200
      WHEN 'pro' THEN 500
      WHEN 'enterprise' THEN NULL
      ELSE 50
    END;
    NEW.admin_limit := CASE lower(trim(NEW.plan))
      WHEN 'basic' THEN 2
      WHEN 'pro' THEN 5
      WHEN 'enterprise' THEN NULL
      ELSE 1
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schools_sync_plan_limits ON public.schools;
CREATE TRIGGER schools_sync_plan_limits
  BEFORE INSERT OR UPDATE OF plan ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_school_plan_limits();

COMMENT ON COLUMN public.schools.student_limit IS
  'Max students for this school; NULL = unlimited (enterprise).';
COMMENT ON COLUMN public.schools.admin_limit IS
  'Max admin seats (members + pending invites); NULL = unlimited (enterprise).';
