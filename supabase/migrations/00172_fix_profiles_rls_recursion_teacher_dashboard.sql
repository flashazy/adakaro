-- Fix: infinite recursion detected in policy for relation "profiles" (42P17)
-- when teachers load /teacher-dashboard (profiles SELECT probe).
--
-- Root cause
-- ----------
-- Permissive SELECT policies on profiles are OR'd. Even a simple self-read
-- (id = auth.uid()) still evaluates every policy expression. Policies such as
-- "Super admins select all profiles" call is_super_admin(), which reads
-- public.profiles. Without SET row_security = off on that helper, the read
-- re-enters profiles RLS and recurses.
--
-- Verify BEFORE applying (run as superuser / SQL editor)
-- -------------------------------------------------------
-- SELECT policyname, cmd, qual::text
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'profiles'
-- ORDER BY policyname;
--
-- SELECT p.proname,
--        pg_get_function_identity_arguments(p.oid) AS args,
--        p.prosecdef AS security_definer,
--        COALESCE((
--          SELECT option_value
--          FROM pg_options_to_table(p.proconfig) AS opt(option_name, option_value)
--          WHERE option_name = 'row_security'
--        ), 'on') AS row_security
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('is_super_admin', 'is_teacher', 'profile_visible_to_school_admin', 'user_school_ids');
--
-- Expected problem state: is_super_admin / is_teacher row_security = 'on'.
--
-- Verify AFTER applying
-- ---------------------
-- Re-run the queries above. Expect:
--   • policy "Users can read own profile" USING (id = auth.uid())
--   • is_super_admin / is_teacher row_security = 'off'
--   • admin/super-admin SELECT policies use helpers only (no inline profiles reads)
--
-- Idempotent: safe on DBs that already have 00048 / 00145 / 00149 / 00156.

-- ---------------------------------------------------------------------------
-- 1) Profile role helpers — SECURITY DEFINER + row_security off
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'::public.user_role
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

COMMENT ON FUNCTION public.is_super_admin() IS
  'True when the current user profile role is super_admin. row_security=off avoids RLS recursion when used from policies on profiles.';

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'teacher'::public.user_role
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

COMMENT ON FUNCTION public.is_teacher() IS
  'True when the current user profile role is teacher. row_security=off avoids RLS recursion when used from policies on profiles.';

-- ---------------------------------------------------------------------------
-- 2) School membership helpers — row_security off (used by admin profile policy)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_school_role(p_school_id uuid)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    (
      SELECT sm.role
      FROM public.school_members sm
      WHERE sm.school_id = p_school_id
        AND sm.user_id = auth.uid()
      LIMIT 1
    ),
    (
      SELECT 'admin'::public.user_role
      FROM public.schools s
      WHERE s.id = p_school_id
        AND s.created_by = auth.uid()
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_members sm
    WHERE sm.school_id = p_school_id
      AND sm.user_id = auth.uid()
      AND sm.role = 'admin'::public.user_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.schools s
    WHERE s.id = p_school_id
      AND s.created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_school_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT sm.school_id
  FROM public.school_members sm
  WHERE sm.user_id = auth.uid()
  UNION
  SELECT s.id
  FROM public.schools s
  WHERE s.created_by = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.profile_visible_to_school_admin(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_members sm
    WHERE sm.user_id = p_profile_id
      AND sm.school_id IN (SELECT public.user_school_ids())
  );
$$;

REVOKE ALL ON FUNCTION public.profile_visible_to_school_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_visible_to_school_admin(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Profiles SELECT — self-read first; admin/super-admin via non-recursive helpers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can read profiles in their schools" ON public.profiles;
CREATE POLICY "Admins can read profiles in their schools"
  ON public.profiles FOR SELECT
  USING (public.profile_visible_to_school_admin(id));

DROP POLICY IF EXISTS "Super admins select all profiles" ON public.profiles;
CREATE POLICY "Super admins select all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_super_admin());

-- Parent visibility for school admins (no profiles subquery — unchanged semantics)
DROP POLICY IF EXISTS "Admins can view parent profiles" ON public.profiles;
CREATE POLICY "Admins can view parent profiles"
  ON public.profiles FOR SELECT
  USING (
    role = 'parent'
    AND (
      EXISTS (
        SELECT 1
        FROM public.school_members sm
        WHERE sm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.schools s
        WHERE s.created_by = auth.uid()
      )
    )
  );
