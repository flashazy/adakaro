-- Track teachers promoted to school admin (badges + revert on removal).
ALTER TABLE public.school_members
  ADD COLUMN IF NOT EXISTS promoted_from_teacher_at timestamptz NULL;

COMMENT ON COLUMN public.school_members.promoted_from_teacher_at IS
  'When set, this admin row was promoted from teacher; reverting removes admin access while keeping teacher membership.';

-- True when the current user has any school_members row with role admin (used for dual teacher/admin UI).
CREATE OR REPLACE FUNCTION public.user_has_school_admin_membership()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_members sm
    WHERE sm.user_id = auth.uid()
      AND sm.role = 'admin'::public.user_role
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_school_admin_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_school_admin_membership() TO authenticated;

COMMENT ON FUNCTION public.user_has_school_admin_membership() IS
  'True when the session user is a school admin for at least one school (membership role admin).';
