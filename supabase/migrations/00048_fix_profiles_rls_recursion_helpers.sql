-- is_super_admin() reads public.profiles inside RLS policy evaluation on profiles,
-- which re-enters profiles policies and triggers "infinite recursion detected in policy for relation profiles".
-- Same pattern as 00041 school_is_operational: SECURITY DEFINER + SET row_security = off.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'::public.user_role
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

COMMENT ON FUNCTION public.is_super_admin() IS
  'True when the current user profile role is super_admin. row_security=off avoids RLS recursion when used from policies on profiles.';

-- Optional: same pattern for teacher role checks from policies / RPCs.
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'teacher'::public.user_role
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

COMMENT ON FUNCTION public.is_teacher() IS
  'True when the current user profile role is teacher. row_security=off avoids RLS recursion when used from policies.';
