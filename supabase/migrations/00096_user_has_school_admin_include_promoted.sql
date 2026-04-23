-- Dual teacher/admin: treat promoted-from-teacher admin rows like admins for
-- middleware + user_has_school_admin_membership (see layout.tsx dual dashboard).
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
      AND (
        sm.role = 'admin'::public.user_role
        OR sm.promoted_from_teacher_at IS NOT NULL
      )
  );
$$;

COMMENT ON FUNCTION public.user_has_school_admin_membership() IS
  'True when the session user is a school admin for at least one school: membership role admin, or promoted from teacher (promoted_from_teacher_at set).';
