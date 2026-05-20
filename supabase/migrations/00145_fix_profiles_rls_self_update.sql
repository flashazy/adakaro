-- Fix: infinite recursion detected in policy for relation "profiles" when users
-- update their own row (e.g. class teachers saving phone).
--
-- Cause: SELECT policies on profiles (especially "Super admins select all profiles")
-- call is_super_admin(), which reads profiles. Without SET row_security = off on the
-- helper, that re-enters profiles RLS and recurses.
--
-- Also: self-service updates must not change role or system-managed columns.

-- ---------------------------------------------------------------------------
-- 1) Profile helpers — SECURITY DEFINER + row_security off (idempotent)
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

CREATE OR REPLACE FUNCTION public.get_school_role(p_school_id uuid)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
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
SET search_path = ''
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_members
    WHERE school_id = p_school_id
      AND user_id = auth.uid()
      AND role = 'admin'
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
SET search_path = ''
SET row_security = off
AS $$
  SELECT school_id
  FROM public.school_members
  WHERE user_id = auth.uid()
  UNION
  SELECT s.id
  FROM public.schools s
  WHERE s.created_by = auth.uid();
$$;

-- School admin can see a profile in their school(s) without nested RLS on profiles.
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
-- 2) Profiles SELECT policies — use non-recursive helpers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can read profiles in their schools" ON public.profiles;
CREATE POLICY "Admins can read profiles in their schools"
  ON public.profiles FOR SELECT
  USING (public.profile_visible_to_school_admin(id));

DROP POLICY IF EXISTS "Super admins select all profiles" ON public.profiles;
CREATE POLICY "Super admins select all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 3) Self-update policy (contact + basic fields; role guarded by trigger)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Block privilege escalation on self-service updates (phone, name, password flags, etc.).
CREATE OR REPLACE FUNCTION public.profiles_enforce_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL OR OLD.id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'You cannot change your account role.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    RAISE EXCEPTION 'last_sign_in_at is managed by the system.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_self_update_guard ON public.profiles;
CREATE TRIGGER profiles_enforce_self_update_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_enforce_self_update_guard();

COMMENT ON FUNCTION public.profiles_enforce_self_update_guard() IS
  'On self-updates: allow phone, full_name, email, avatar_url, password_* fields; block role and last_sign_in_at changes.';

-- ---------------------------------------------------------------------------
-- 4) Other policies that inlined profiles reads for super_admin checks
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admins can manage report preferences" ON public.admin_report_preferences;
CREATE POLICY "Super admins can manage report preferences"
  ON public.admin_report_preferences
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Optional RPC: update own phone without depending on permissive SELECT policy chain.
CREATE OR REPLACE FUNCTION public.update_own_profile_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_phone text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  v_phone := NULLIF(trim(COALESCE(p_phone, '')), '');

  UPDATE public.profiles
  SET phone = v_phone,
      updated_at = now()
  WHERE id = auth.uid();

  RETURN v_phone;
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_profile_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_profile_phone(text) TO authenticated;

COMMENT ON FUNCTION public.update_own_profile_phone(text) IS
  'Sets phone on the caller''s profile. SECURITY DEFINER + row_security=off avoids profiles RLS recursion.';
