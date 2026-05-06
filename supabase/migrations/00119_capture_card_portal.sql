-- Student Capture Portal: approval workflow, capture_card_users, RLS, helpers.
-- Requires 00118_add_capture_card_role.sql (adds enum value user_role.capture_card_user).
--
-- Adakaro schema reference (this repo — there is NO public.user_roles table):
--   • Roles: PostgreSQL enum public.user_role on public.profiles.role and
--     public.school_members.role (plus later enum values from other migrations).
--   • Primary school for the signed-in user: public.get_my_school_id() (UUID).
--   • Dashboard school payload (name, currency, plan): public.get_my_school_for_dashboard() (JSONB).
-- This migration replaces both RPCs to add capture-card school resolution; it also
-- ensures schools.currency / schools.plan exist so CREATE FUNCTION validates on thin DBs.

-- ---------------------------------------------------------------------------
-- Prerequisites for RPC bodies (safe on partial / legacy databases)
-- ---------------------------------------------------------------------------
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KES';

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- ---------------------------------------------------------------------------
-- students: approval + provenance
-- ---------------------------------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS enrolled_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS rejection_reason text;

UPDATE public.students
SET approval_status = 'approved'
WHERE approval_status IS DISTINCT FROM 'approved';

COMMENT ON COLUMN public.students.approval_status IS
  'pending = capture-card Awaiting admin; approved = normal roster; rejected = hidden from roster.';

COMMENT ON COLUMN public.students.enrolled_by IS
  'auth.users id of the account that created this row (admin or capture-card user).';

CREATE INDEX IF NOT EXISTS idx_students_school_approval
  ON public.students (school_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_students_enrolled_by
  ON public.students (enrolled_by)
  WHERE enrolled_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- capture_card_users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.capture_card_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  username text NOT NULL,
  /** Synthetic email used with Supabase Auth signInWithPassword (not shown to end users). */
  auth_email text NOT NULL UNIQUE,
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  /** Reserved; passwords are stored in Supabase Auth. */
  password_hash text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capture_card_users_school_username_lower
  ON public.capture_card_users (school_id, lower(trim(username)));

CREATE INDEX IF NOT EXISTS idx_capture_card_users_school_id
  ON public.capture_card_users (school_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'capture_card_users'
      AND t.tgname = 'capture_card_users_updated_at'
  ) THEN
    CREATE TRIGGER capture_card_users_updated_at
      BEFORE UPDATE ON public.capture_card_users
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

ALTER TABLE public.capture_card_users ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.capture_card_users IS
  'Temporary capture-card accounts for a school; auth via auth_email + Supabase Auth.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_capture_card_user()
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
      AND p.role = 'capture_card_user'::public.user_role
  );
$$;

REVOKE ALL ON FUNCTION public.is_capture_card_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_capture_card_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_capture_card_user_for_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.capture_card_users ccu
    WHERE ccu.auth_user_id = auth.uid()
      AND ccu.school_id = p_school_id
      AND ccu.is_active = true
      AND (ccu.expires_at IS NULL OR ccu.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_capture_card_user_for_school(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_capture_card_user_for_school(uuid) TO authenticated;

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
    ),
    (
      SELECT ccu.school_id
      FROM public.capture_card_users ccu
      WHERE ccu.auth_user_id = auth.uid()
        AND ccu.is_active = true
        AND (ccu.expires_at IS NULL OR ccu.expires_at > now())
      ORDER BY ccu.created_at ASC
      LIMIT 1
    )
  );
$$;

COMMENT ON FUNCTION public.get_my_school_id() IS
  'Primary school: membership, founding school, or active capture-card school.';

REVOKE ALL ON FUNCTION public.get_my_school_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_school_for_dashboard()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'school_id', s.id,
        'name', s.name,
        'currency', s.currency,
        'plan', s.plan
      )
      FROM public.school_members sm
      INNER JOIN public.schools s ON s.id = sm.school_id
      WHERE sm.user_id = auth.uid()
      ORDER BY sm.created_at ASC
      LIMIT 1
    ),
    (
      SELECT jsonb_build_object(
        'school_id', s.id,
        'name', s.name,
        'currency', s.currency,
        'plan', s.plan
      )
      FROM public.schools s
      WHERE s.created_by = auth.uid()
      ORDER BY s.created_at ASC
      LIMIT 1
    ),
    (
      SELECT jsonb_build_object(
        'school_id', s.id,
        'name', s.name,
        'currency', s.currency,
        'plan', s.plan
      )
      FROM public.capture_card_users ccu
      INNER JOIN public.schools s ON s.id = ccu.school_id
      WHERE ccu.auth_user_id = auth.uid()
        AND ccu.is_active = true
        AND (ccu.expires_at IS NULL OR ccu.expires_at > now())
      ORDER BY ccu.created_at ASC
      LIMIT 1
    )
  );
$$;

COMMENT ON FUNCTION public.get_my_school_for_dashboard() IS
  'Returns { school_id, name, currency, plan } for the current user: school_members,'
  ' founding school (schools.created_by), or active capture_card_users row. SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.get_my_school_for_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_school_for_dashboard() TO authenticated;

-- Admission numbers for capture-card users
CREATE OR REPLACE FUNCTION public.peek_next_admission_number(p_school_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  school_prefix character varying(10);
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (
    public.is_school_admin(p_school_id)
    OR public.is_active_capture_card_user_for_school(p_school_id)
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT admission_prefix INTO school_prefix
  FROM public.schools
  WHERE id = p_school_id;

  IF school_prefix IS NULL OR trim(school_prefix) = '' THEN
    RETURN NULL;
  END IF;

  SELECT c.next_number INTO n
  FROM public.school_admission_counters c
  WHERE c.school_id = p_school_id;

  IF NOT FOUND THEN
    n := 1;
  END IF;

  RETURN trim(school_prefix) || '-' || lpad(n::text, 3, '0');
END;
$$;

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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (
    public.is_school_admin(p_school_id)
    OR public.is_active_capture_card_user_for_school(p_school_id)
  ) THEN
    RAISE EXCEPTION 'Forbidden';
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

-- Parent recovery: only roster-approved students
CREATE OR REPLACE FUNCTION public.lookup_student_by_admission(
  adm_number text,
  p_prefer_school_id uuid DEFAULT NULL
)
RETURNS TABLE (student_id uuid, school_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.school_id
  FROM public.students s
  WHERE lower(trim(s.admission_number)) = lower(trim(COALESCE(adm_number, '')))
    AND trim(COALESCE(s.admission_number, '')) <> ''
    AND s.approval_status = 'approved'
  ORDER BY
    CASE
      WHEN p_prefer_school_id IS NOT NULL AND s.school_id = p_prefer_school_id THEN 0
      ELSE 1
    END,
    s.created_at ASC
  LIMIT 1;
$$;

-- Teachers / parents: hide non-approved students
DROP POLICY IF EXISTS "Teachers select students in assigned classes" ON public.students;
CREATE POLICY "Teachers select students in assigned classes"
  ON public.students FOR SELECT
  USING (
    public.is_teacher_for_class(class_id)
    AND approval_status = 'approved'
  );

DROP POLICY IF EXISTS "Parents can view linked students" ON public.students;
CREATE POLICY "Parents can view linked students"
  ON public.students FOR SELECT
  USING (
    id IN (SELECT public.parent_student_ids())
    AND approval_status = 'approved'
  );

-- Capture card: read own captured rows
DROP POLICY IF EXISTS "Capture card users select own students" ON public.students;
CREATE POLICY "Capture card users select own students"
  ON public.students FOR SELECT
  TO authenticated
  USING (
    public.is_capture_card_user()
    AND enrolled_by = auth.uid()
  );

-- Capture card: insert
DROP POLICY IF EXISTS "Capture card users insert students" ON public.students;
CREATE POLICY "Capture card users insert students"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_capture_card_user()
    AND enrolled_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.capture_card_users ccu
      WHERE ccu.auth_user_id = auth.uid()
        AND ccu.school_id = students.school_id
        AND ccu.is_active = true
        AND (ccu.expires_at IS NULL OR ccu.expires_at > now())
    )
    AND (
      (
        approval_status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.capture_card_users ccu
          WHERE ccu.auth_user_id = auth.uid()
            AND ccu.requires_approval = true
        )
      )
      OR
      (
        approval_status = 'approved'
        AND EXISTS (
          SELECT 1
          FROM public.capture_card_users ccu
          WHERE ccu.auth_user_id = auth.uid()
            AND ccu.requires_approval = false
        )
      )
    )
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND rejected_at IS NULL
  );

-- Capture card: update pending / rejected only; cannot self-approve
DROP POLICY IF EXISTS "Capture card users update own students" ON public.students;
CREATE POLICY "Capture card users update own students"
  ON public.students FOR UPDATE
  TO authenticated
  USING (
    public.is_capture_card_user()
    AND enrolled_by = auth.uid()
    AND approval_status IN ('pending', 'rejected')
  )
  WITH CHECK (
    public.is_capture_card_user()
    AND enrolled_by = auth.uid()
    AND approval_status IN ('pending', 'rejected')
    AND approved_by IS NULL
    AND approved_at IS NULL
  );

-- capture_card_users policies
DROP POLICY IF EXISTS "School admins manage capture card users" ON public.capture_card_users;
CREATE POLICY "School admins manage capture card users"
  ON public.capture_card_users FOR ALL
  TO authenticated
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));

DROP POLICY IF EXISTS "Capture card users read own account" ON public.capture_card_users;
CREATE POLICY "Capture card users read own account"
  ON public.capture_card_users FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_card_users TO authenticated;

-- Classes: capture users may list classes for their school (enrolment picker)
DROP POLICY IF EXISTS "Capture card users select classes" ON public.classes;
CREATE POLICY "Capture card users select classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (
    public.is_capture_card_user()
    AND public.is_active_capture_card_user_for_school(school_id)
  );

-- Schools: name/plan for capture header (read-only)
DROP POLICY IF EXISTS "Capture card users select their school" ON public.schools;
CREATE POLICY "Capture card users select their school"
  ON public.schools FOR SELECT
  TO authenticated
  USING (
    public.is_capture_card_user()
    AND public.is_active_capture_card_user_for_school(id)
  );

-- Student avatars from capture-card users
CREATE OR REPLACE FUNCTION public.can_manage_student_avatar_storage(
  p_bucket_id text,
  p_name text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  student_id uuid;
BEGIN
  IF p_bucket_id IS DISTINCT FROM 'student-avatars' THEN
    RETURN FALSE;
  END IF;
  IF split_part(p_name, '/', 2) NOT IN ('avatar.webp', 'avatar.jpg', 'avatar.png') THEN
    RETURN FALSE;
  END IF;
  BEGIN
    student_id := (split_part(p_name, '/', 1))::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN FALSE;
  END;
  RETURN EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = student_id
      AND (
        public.is_school_admin(s.school_id)
        OR public.is_teacher_for_class(s.class_id)
        OR public.is_super_admin()
        OR (
          public.is_capture_card_user()
          AND s.enrolled_by = auth.uid()
          AND s.approval_status IN ('pending', 'rejected')
        )
      )
  );
END;
$$;
