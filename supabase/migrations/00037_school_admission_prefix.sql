-- School-specific admission number prefixes and atomic sequence (PREFIX-001).

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS admission_prefix character varying(10);

CREATE UNIQUE INDEX IF NOT EXISTS schools_admission_prefix_unique
  ON public.schools (admission_prefix)
  WHERE admission_prefix IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.school_admission_counters (
  school_id uuid PRIMARY KEY REFERENCES public.schools (id) ON DELETE CASCADE,
  next_number integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.school_admission_counters IS
  'Next sequence index per school for get_next_admission_number (formatted as PREFIX-NNN).';

DROP TRIGGER IF EXISTS school_admission_counters_updated_at ON public.school_admission_counters;
CREATE TRIGGER school_admission_counters_updated_at
  BEFORE UPDATE ON public.school_admission_counters
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.school_admission_counters ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Generate a unique 3–4 character prefix from a school name (no auth).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_unique_prefix(p_school_name text)
RETURNS character varying(10)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate character varying(10);
  counter integer := 0;
BEGIN
  base := upper(regexp_replace(coalesce(p_school_name, ''), '[^a-zA-Z]', '', 'g'));
  IF length(base) < 3 THEN
    base := rpad(base, 3, 'X');
  END IF;
  base := left(base, 4);

  candidate := left(base, 3);

  WHILE EXISTS (
    SELECT 1 FROM public.schools s WHERE s.admission_prefix = candidate
  ) LOOP
    counter := counter + 1;
    candidate := left(base, 3) || counter::text;
    IF length(candidate) > 4 THEN
      candidate := left(base, 2) || counter::text;
    END IF;
    IF length(candidate) > 4 THEN
      candidate := left(base, 1) || lpad(counter::text, 3, '0');
    END IF;
    IF length(candidate) > 10 THEN
      candidate := 'SCH' || counter::text;
    END IF;
    EXIT WHEN counter > 9999;
  END LOOP;

  RETURN left(candidate, 10);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_unique_prefix(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_unique_prefix(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_prefix(text) TO service_role;

-- ---------------------------------------------------------------------------
-- Peek next formatted admission number without consuming sequence.
-- ---------------------------------------------------------------------------
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
  IF NOT public.is_school_admin(p_school_id) THEN
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

REVOKE ALL ON FUNCTION public.peek_next_admission_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_next_admission_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peek_next_admission_number(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Allocate next admission number (atomic increment).
-- ---------------------------------------------------------------------------
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
  IF NOT public.is_school_admin(p_school_id) THEN
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

REVOKE ALL ON FUNCTION public.get_next_admission_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_admission_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_admission_number(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Backfill prefixes for schools missing one
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, name FROM public.schools WHERE admission_prefix IS NULL
  LOOP
    UPDATE public.schools
    SET admission_prefix = public.generate_unique_prefix(r.name)
    WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Initialize counters from existing admission_number values
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  max_n integer;
BEGIN
  FOR r IN SELECT id FROM public.schools
  LOOP
    SELECT coalesce(max(
      coalesce(
        (regexp_match(s.admission_number, '-([0-9]+)\s*$'))[1]::integer,
        CASE
          WHEN trim(coalesce(s.admission_number, '')) ~ '^[0-9]+$'
            THEN trim(s.admission_number)::integer
          ELSE NULL
        END
      )
    ), 0) + 1
    INTO max_n
    FROM public.students s
    WHERE s.school_id = r.id
      AND s.admission_number IS NOT NULL
      AND trim(s.admission_number) <> '';

    INSERT INTO public.school_admission_counters (school_id, next_number)
    VALUES (r.id, greatest(max_n, 1))
    ON CONFLICT (school_id) DO UPDATE
    SET next_number = greatest(
      public.school_admission_counters.next_number,
      excluded.next_number
    ),
    updated_at = now();
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- create_founding_school: optional admission prefix (3–4 A–Z) or auto-generate
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_founding_school(text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_founding_school(
  p_name text,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_currency text DEFAULT 'KES',
  p_admission_prefix text DEFAULT NULL
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
  v_prefix text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_jwt_role := lower(trim(coalesce(
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

  IF trim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'School name is required';
  END IF;

  v_currency := upper(trim(coalesce(p_currency, 'KES')));
  IF v_currency NOT IN ('TZS', 'KES', 'UGX', 'USD') THEN
    RAISE EXCEPTION 'Invalid currency (use TZS, KES, UGX, or USD)';
  END IF;

  IF p_admission_prefix IS NOT NULL AND trim(p_admission_prefix) <> '' THEN
    v_prefix := upper(trim(p_admission_prefix));
    IF v_prefix !~ '^[A-Z]{3,4}$' THEN
      RAISE EXCEPTION 'Admission prefix must be 3 to 4 letters (A–Z)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.schools s WHERE s.admission_prefix = v_prefix
    ) THEN
      RAISE EXCEPTION 'Admission prefix already in use';
    END IF;
  ELSE
    v_prefix := public.generate_unique_prefix(trim(p_name));
  END IF;

  INSERT INTO public.schools (
    name, address, phone, email, logo_url, created_by, currency, admission_prefix
  )
  VALUES (
    trim(p_name),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    p_logo_url,
    auth.uid(),
    v_currency,
    v_prefix
  )
  RETURNING id INTO v_school_id;

  INSERT INTO public.school_admission_counters (school_id, next_number)
  VALUES (v_school_id, 1)
  ON CONFLICT (school_id) DO NOTHING;

  RETURN v_school_id;
END;
$$;

COMMENT ON FUNCTION public.create_founding_school(text, text, text, text, text, text, text) IS
  'Creates a school and founding admin (trigger). Optional p_admission_prefix: 3–4 A–Z, unique; if null, generated from name.';

REVOKE ALL ON FUNCTION public.create_founding_school(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_founding_school(text, text, text, text, text, text, text) TO authenticated;
