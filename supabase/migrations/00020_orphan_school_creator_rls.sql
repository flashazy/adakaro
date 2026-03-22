-- Orphan schools: schools row exists with created_by = user but no school_members row
-- (e.g. school created before on_school_created trigger). Dashboard + RLS then
-- behave as if the user has no school.

-- 1) Backfill missing founding admin memberships (idempotent)
INSERT INTO public.school_members (school_id, user_id, role)
SELECT s.id, s.created_by, 'admin'::public.user_role
FROM public.schools s
WHERE NOT EXISTS (
  SELECT 1 FROM public.school_members sm
  WHERE sm.school_id = s.id AND sm.user_id = s.created_by
)
ON CONFLICT (school_id, user_id) DO NOTHING;

-- 2) Helpers: treat school creator as admin / member when membership row is missing
CREATE OR REPLACE FUNCTION public.get_school_role(p_school_id uuid)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT sm.role FROM public.school_members sm
      WHERE sm.school_id = p_school_id AND sm.user_id = auth.uid()
      LIMIT 1
    ),
    (
      SELECT 'admin'::public.user_role
      FROM public.schools s
      WHERE s.id = p_school_id AND s.created_by = auth.uid()
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
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_members
    WHERE school_id = p_school_id
      AND user_id = auth.uid()
      AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = p_school_id AND s.created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_school_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT school_id FROM public.school_members WHERE user_id = auth.uid()
  UNION
  SELECT s.id FROM public.schools s WHERE s.created_by = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT sm.school_id
      FROM public.school_members sm
      WHERE sm.user_id = auth.uid()
      ORDER BY sm.created_at ASC
      LIMIT 1
    ),
    (
      SELECT s.id
      FROM public.schools s
      WHERE s.created_by = auth.uid()
      ORDER BY s.created_at ASC
      LIMIT 1
    )
  );
$$;

-- 3) Block duplicate founding schools if user is only linked via created_by
CREATE OR REPLACE FUNCTION public.create_founding_school(
  p_name text,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_logo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_jwt_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_jwt_role := lower(trim(COALESCE(
    (SELECT auth.jwt())->'user_metadata'->>'role',
    ''
  )));

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR v_jwt_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only school admins can create a school. Set profiles.role to admin for your user, or ensure signup stored role admin in user metadata.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.school_members sm WHERE sm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.schools s WHERE s.created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You already belong to a school';
  END IF;

  IF trim(COALESCE(p_name, '')) = '' THEN
    RAISE EXCEPTION 'School name is required';
  END IF;

  INSERT INTO public.schools (name, address, phone, email, logo_url, created_by)
  VALUES (
    trim(p_name),
    NULLIF(trim(COALESCE(p_address, '')), ''),
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    NULLIF(trim(COALESCE(p_email, '')), ''),
    p_logo_url,
    auth.uid()
  )
  RETURNING id INTO v_school_id;

  RETURN v_school_id;
END;
$$;

-- 4) RLS: parent-profile visibility for creators without a membership row yet
DROP POLICY IF EXISTS "Admins can view parent profiles" ON public.profiles;
CREATE POLICY "Admins can view parent profiles"
  ON public.profiles FOR SELECT
  USING (
    role = 'parent'
    AND (
      EXISTS (
        SELECT 1 FROM public.school_members sm
        WHERE sm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.schools s
        WHERE s.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Admins can view school requests" ON public.parent_link_requests;
DROP POLICY IF EXISTS "Admins can update school requests" ON public.parent_link_requests;

CREATE POLICY "Admins can view school requests"
  ON public.parent_link_requests FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins can update school requests"
  ON public.parent_link_requests FOR UPDATE
  USING (school_id IN (SELECT public.user_school_ids()));
