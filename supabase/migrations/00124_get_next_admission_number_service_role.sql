-- Capture card enrollment uses the Supabase admin client (service_role JWT).
-- get_next_admission_number previously required auth.uid(), which is null for
-- service_role — so the app fell back to a non-atomic TS counter and hit
-- duplicate (school_id, admission_number). Allow service_role to call the same
-- atomic sequence as authenticated admins / capture card users.

CREATE OR REPLACE FUNCTION public.get_next_admission_number(p_school_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  school_prefix character varying(10);
  next_num integer;
  result text;
  jwt_role text;
BEGIN
  jwt_role := coalesce((SELECT auth.jwt())->>'role', '');

  IF jwt_role IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF NOT (
      public.is_school_admin(p_school_id)
      OR public.is_active_capture_card_user_for_school(p_school_id)
    ) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  SELECT admission_prefix INTO school_prefix
  FROM public.schools
  WHERE id = p_school_id;

  IF school_prefix IS NULL OR trim(school_prefix) = '' THEN
    RAISE EXCEPTION 'School has no admission prefix set';
  END IF;

  INSERT INTO public.school_admission_counters (school_id, next_number)
  VALUES (p_school_id, 1)
  ON CONFLICT (school_id) DO UPDATE
  SET
    next_number = public.school_admission_counters.next_number + 1,
    updated_at = now()
  RETURNING next_number INTO next_num;

  result := trim(school_prefix) || '-' || lpad(next_num::text, 3, '0');
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_next_admission_number(uuid) IS
  'Atomically allocates next formatted admission number (PREFIX-NNN). Callable with authenticated user (admin or active capture card user for school) or service_role (server admin client).';
