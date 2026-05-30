-- Database-level enforcement: free-tier schools cannot exceed 20 approved students.
-- Matches application logic in lib/plan-limits.ts (approved rows only).

CREATE OR REPLACE FUNCTION public.enforce_free_tier_student_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  school_plan text;
  approved_count integer;
  free_limit constant integer := 20;
BEGIN
  -- Pending / rejected rows do not count toward the cap until approved.
  IF NEW.approval_status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT lower(trim(coalesce(s.plan, 'free')))
  INTO school_plan
  FROM public.schools s
  WHERE s.id = NEW.school_id;

  IF school_plan IS NULL THEN
    RAISE EXCEPTION 'School not found for student enrolment';
  END IF;

  -- Any non-free plan is unlimited (basic / pro / enterprise / legacy paid labels).
  IF school_plan <> 'free' THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::integer
  INTO approved_count
  FROM public.students st
  WHERE st.school_id = NEW.school_id
    AND st.approval_status = 'approved';

  IF approved_count >= free_limit THEN
    RAISE EXCEPTION 'Free plan limited to 20 students. Please upgrade.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_free_tier_student_limit() IS
  'BEFORE INSERT on students: blocks approved enrolments when a free-plan school already has 20 approved students.';

DROP TRIGGER IF EXISTS students_enforce_free_tier_limit ON public.students;
CREATE TRIGGER students_enforce_free_tier_limit
  BEFORE INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_free_tier_student_limit();
