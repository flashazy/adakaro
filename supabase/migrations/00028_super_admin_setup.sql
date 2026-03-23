-- Platform super admin: enum value, helper, RLS, RPCs

-- ---------------------------------------------------------------------------
-- 1) Enum (PG 15+ supports IF NOT EXISTS on ADD VALUE)
-- ---------------------------------------------------------------------------
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ---------------------------------------------------------------------------
-- 2) Helper (SECURITY DEFINER so RLS on profiles does not block)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
  'True when the current user profile role is super_admin.';

-- ---------------------------------------------------------------------------
-- 3) RLS — super admins see / manage platform-wide reads & plan updates
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admins select all profiles" ON public.profiles;
CREATE POLICY "Super admins select all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins select all schools" ON public.schools;
CREATE POLICY "Super admins select all schools"
  ON public.schools FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update any school" ON public.schools;
CREATE POLICY "Super admins update any school"
  ON public.schools FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins select all school_members" ON public.school_members;
CREATE POLICY "Super admins select all school_members"
  ON public.school_members FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update school_members" ON public.school_members;
CREATE POLICY "Super admins update school_members"
  ON public.school_members FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins delete school_members" ON public.school_members;
CREATE POLICY "Super admins delete school_members"
  ON public.school_members FOR DELETE
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins select all invitations" ON public.school_invitations;
CREATE POLICY "Super admins select all invitations"
  ON public.school_invitations FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins delete invitations" ON public.school_invitations;
CREATE POLICY "Super admins delete invitations"
  ON public.school_invitations FOR DELETE
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins select all students" ON public.students;
CREATE POLICY "Super admins select all students"
  ON public.students FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins select all payments" ON public.payments;
CREATE POLICY "Super admins select all payments"
  ON public.payments FOR SELECT
  USING (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 4) Create school + assign founding admin (trigger adds school_members row)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.super_admin_create_school(
  p_name text,
  p_currency text,
  p_plan text,
  p_admin_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_currency text;
  v_plan text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'School name is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_user_id) THEN
    RAISE EXCEPTION 'Admin user profile not found';
  END IF;

  v_currency := upper(btrim(coalesce(p_currency, 'TZS')));
  IF v_currency NOT IN ('TZS', 'KES', 'UGX', 'USD') THEN
    v_currency := 'TZS';
  END IF;

  v_plan := lower(btrim(coalesce(p_plan, 'free')));
  IF v_plan NOT IN ('free', 'basic', 'pro', 'enterprise') THEN
    v_plan := 'free';
  END IF;

  INSERT INTO public.schools (
    name,
    address,
    phone,
    email,
    logo_url,
    currency,
    plan,
    created_by
  )
  VALUES (
    btrim(p_name),
    NULL,
    NULL,
    NULL,
    NULL,
    v_currency,
    v_plan,
    p_admin_user_id
  )
  RETURNING id INTO v_school_id;

  -- Promote parent to school admin only (never downgrade super_admin)
  UPDATE public.profiles
  SET role = 'admin'::public.user_role,
      updated_at = now()
  WHERE id = p_admin_user_id
    AND role = 'parent'::public.user_role;

  RETURN v_school_id;
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_create_school(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_create_school(text, text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Aggregates for dashboard (avoids N+1)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.super_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  r jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total_schools', (SELECT count(*)::bigint FROM public.schools),
    'total_students', (SELECT count(*)::bigint FROM public.students),
    'total_admins', (
      SELECT count(*)::bigint FROM public.school_members WHERE role = 'admin'::public.user_role
    ),
    'total_payments', (SELECT count(*)::bigint FROM public.payments)
  )
  INTO r;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_dashboard_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.super_admin_list_schools_with_counts()
RETURNS TABLE (
  id uuid,
  name text,
  plan text,
  currency text,
  created_at timestamptz,
  created_by uuid,
  admin_count bigint,
  student_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.plan,
    s.currency,
    s.created_at,
    s.created_by,
    (SELECT count(*)::bigint
     FROM public.school_members sm
     WHERE sm.school_id = s.id AND sm.role = 'admin'::public.user_role),
    (SELECT count(*)::bigint
     FROM public.students st
     WHERE st.school_id = s.id)
  FROM public.schools s
  ORDER BY s.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_list_schools_with_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_list_schools_with_counts() TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Super admins can create invitations for any school (platform support)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admins insert invitations" ON public.school_invitations;
CREATE POLICY "Super admins insert invitations"
  ON public.school_invitations FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update invitations" ON public.school_invitations;
CREATE POLICY "Super admins update invitations"
  ON public.school_invitations FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 7) Allow is_email_already_school_admin for super admins (invite API)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_email_already_school_admin(
  p_school_id uuid,
  p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT (
    (SELECT public.is_school_admin(p_school_id))
    OR (SELECT public.is_super_admin())
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.school_members sm ON sm.user_id = p.id
    WHERE sm.school_id = p_school_id
      AND sm.role = 'admin'::user_role
      AND lower(trim(COALESCE(p.email, ''))) = lower(trim(COALESCE(p_email, '')))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_email_already_school_admin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_email_already_school_admin(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.is_email_already_school_admin(uuid, text) IS
  'True if email is already a school admin. Caller must be school admin or super_admin.';
