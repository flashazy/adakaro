-- Fix: infinite recursion detected in policy for relation "profiles" (42P17)
-- when school admins open Enrollment Desk Users (/dashboard/capture-card-users).
--
-- Cause: is_school_admin() without SET row_security = off reads public.schools under RLS;
-- schools policies call is_super_admin(), which reads profiles under RLS; profiles
-- policies call is_super_admin() again → recursion.
--
-- Also re-assert profiles helpers/policies (same as 00145) for DBs that missed that migration.

-- ---------------------------------------------------------------------------
-- 1) Helpers — SECURITY DEFINER + row_security off
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

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.is_teacher() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
REVOKE ALL ON FUNCTION public.profile_visible_to_school_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_visible_to_school_admin(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Profiles SELECT — non-recursive policies
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
-- 3) capture_card_users — explicit admin check (no nested RLS)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "School admins manage capture card users" ON public.capture_card_users;
CREATE POLICY "School admins manage capture card users"
  ON public.capture_card_users FOR ALL
  TO authenticated
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));

-- enrollment_desk_access_tokens (same page load)
DROP POLICY IF EXISTS enrollment_desk_access_tokens_select ON public.enrollment_desk_access_tokens;
CREATE POLICY enrollment_desk_access_tokens_select
  ON public.enrollment_desk_access_tokens FOR SELECT
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS enrollment_desk_access_tokens_insert ON public.enrollment_desk_access_tokens;
CREATE POLICY enrollment_desk_access_tokens_insert
  ON public.enrollment_desk_access_tokens FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS enrollment_desk_access_tokens_update ON public.enrollment_desk_access_tokens;
CREATE POLICY enrollment_desk_access_tokens_update
  ON public.enrollment_desk_access_tokens FOR UPDATE
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 4) Server-side list RPCs (bypass RLS for authorized admins only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_capture_card_users_for_school_admin(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_school_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT public.is_school_admin(p_school_id) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          id,
          username,
          is_active,
          expires_at,
          requires_approval,
          created_at,
          is_quick_qr_user,
          quick_qr_label,
          quick_qr_note
        FROM public.capture_card_users
        WHERE school_id = p_school_id
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_active_enrollment_desk_tokens_for_school(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_school_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT public.is_school_admin(p_school_id) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(t))
      FROM (
        SELECT capture_card_user_id, expires_at
        FROM public.enrollment_desk_access_tokens
        WHERE school_id = p_school_id
          AND revoked_at IS NULL
          AND used_at IS NULL
          AND expires_at > now()
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_capture_card_users_for_school_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_capture_card_users_for_school_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.list_active_enrollment_desk_tokens_for_school(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_active_enrollment_desk_tokens_for_school(uuid) TO authenticated;

COMMENT ON FUNCTION public.list_capture_card_users_for_school_admin(uuid) IS
  'Returns capture_card_users rows for a school when caller is school admin. Avoids profiles RLS recursion.';

COMMENT ON FUNCTION public.list_active_enrollment_desk_tokens_for_school(uuid) IS
  'Returns active enrollment_desk_access_tokens for a school when caller is school admin.';
