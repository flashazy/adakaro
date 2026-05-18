-- Fix duty book access when public.profiles is missing on older/partial databases.
-- Adakaro canonical user table: public.profiles (extends auth.users).
-- See 00001_initial_schema.sql / 00002_safe_setup.sql.

-- ---------------------------------------------------------------------------
-- 1) Ensure enum + profiles table exist
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'parent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'teacher';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'accounts';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'capture_card_user';

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  role public.user_role NOT NULL DEFAULT 'parent',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Backfill rows for auth users missing a profile (safe if table already populated).
INSERT INTO public.profiles (id, full_name, email, phone, role)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1), ''),
  u.email,
  NULLIF(trim(u.raw_user_meta_data ->> 'phone'), ''),
  CASE
    WHEN (u.raw_user_meta_data ->> 'role') IN (
      'admin', 'parent', 'teacher', 'super_admin',
      'finance', 'accounts', 'capture_card_user'
    ) THEN (u.raw_user_meta_data ->> 'role')::public.user_role
    ELSE 'parent'::public.user_role
  END
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2) Duty book helpers — do not call is_super_admin() (requires profiles);
--    use school_members / teacher_assignments / schools only.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_view_duty_book(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.is_school_admin(p_school_id)
    OR public.is_teacher_for_school(p_school_id)
    OR public.is_school_head_teacher(p_school_id)
    OR (
      to_regclass('public.profiles') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'super_admin'::public.user_role
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_duty_book(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_duty_book(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_sign_duty_book_report(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.is_school_head_teacher(p_school_id)
    OR (
      public.is_school_admin(p_school_id)
      AND EXISTS (
        SELECT 1
        FROM public.schools s
        WHERE s.id = p_school_id
          AND s.head_teacher_id IS NULL
      )
    )
    OR (
      to_regclass('public.profiles') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'super_admin'::public.user_role
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_sign_duty_book_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_sign_duty_book_report(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Re-assert head teacher + duty book FKs point at profiles (idempotent)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schools'
      AND column_name = 'head_teacher_id'
  ) THEN
    ALTER TABLE public.schools
      ADD COLUMN head_teacher_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schools_head_teacher_id
  ON public.schools (head_teacher_id)
  WHERE head_teacher_id IS NOT NULL;
