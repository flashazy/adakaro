-- Per-school display/settlement currency (amounts stored as numbers; no FX in app).

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KES';

ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_currency_check;
ALTER TABLE public.schools
  ADD CONSTRAINT schools_currency_check
  CHECK (currency IN ('TZS', 'KES', 'UGX', 'USD'));

COMMENT ON COLUMN public.schools.currency IS
  'ISO currency code for fee amounts and UI. Allowed: TZS, KES, UGX, USD.';

-- Parents need to read currency for linked students' schools (not school_members).
DROP POLICY IF EXISTS "Parents can view schools of linked students" ON public.schools;
CREATE POLICY "Parents can view schools of linked students"
  ON public.schools FOR SELECT
  USING (
    id IN (
      SELECT s.school_id
      FROM public.students s
      WHERE s.id IN (SELECT public.parent_student_ids())
    )
  );

-- Replace founding-school RPC with optional currency (defaults KES).
DROP FUNCTION IF EXISTS public.create_founding_school(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_founding_school(
  p_name text,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_currency text DEFAULT 'KES'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_jwt_role text;
  v_currency text;
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

  v_currency := upper(trim(COALESCE(p_currency, 'KES')));
  IF v_currency NOT IN ('TZS', 'KES', 'UGX', 'USD') THEN
    RAISE EXCEPTION 'Invalid currency (use TZS, KES, UGX, or USD)';
  END IF;

  INSERT INTO public.schools (
    name, address, phone, email, logo_url, created_by, currency
  )
  VALUES (
    trim(p_name),
    NULLIF(trim(COALESCE(p_address, '')), ''),
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    NULLIF(trim(COALESCE(p_email, '')), ''),
    p_logo_url,
    auth.uid(),
    v_currency
  )
  RETURNING id INTO v_school_id;

  RETURN v_school_id;
END;
$$;

COMMENT ON FUNCTION public.create_founding_school(text, text, text, text, text, text) IS
  'Creates a school and links the current user as admin (via trigger). Optional p_currency: TZS|KES|UGX|USD.';

REVOKE ALL ON FUNCTION public.create_founding_school(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_founding_school(text, text, text, text, text, text) TO authenticated;
