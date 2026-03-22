-- =============================================================================
-- Adakaro — core schema (admin + parent dashboards, no payment-gateway tables)
-- =============================================================================
-- Idempotent: IF NOT EXISTS, DROP/CREATE policies, ADD COLUMN IF NOT EXISTS.
-- Tables: profiles, schools, school_members, classes, students, fee_types,
-- fee_structures, payments, receipts, parent_students, parent_link_requests.
-- Views: student_fee_balances (app), fee_balances (alias).
-- =============================================================================

-- ---------- EXTENSIONS ----------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- ENUM TYPES ----------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'parent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.student_status AS ENUM ('active', 'inactive', 'graduated', 'transferred');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM (
    'cash', 'bank_transfer', 'mobile_money', 'card', 'cheque'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $do$
BEGIN
  ALTER TYPE public.payment_method ADD VALUE 'clickpesa';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$do$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'completed', 'pending', 'failed', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- UPDATED_AT HELPER ----------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- NEW USER → PROFILE ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'parent')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text NOT NULL DEFAULT '',
  email      text,
  phone      text,
  role       public.user_role NOT NULL DEFAULT 'parent',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.schools (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  address    text,
  phone      text,
  email      text,
  logo_url   text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KES';
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_currency_check;
ALTER TABLE public.schools
  ADD CONSTRAINT schools_currency_check
  CHECK (currency IN ('TZS', 'KES', 'UGX', 'USD'));

CREATE INDEX IF NOT EXISTS idx_schools_created_by ON public.schools(created_by);

DROP TRIGGER IF EXISTS schools_updated_at ON public.schools;
CREATE TRIGGER schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.school_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       public.user_role NOT NULL DEFAULT 'parent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_school_members_user ON public.school_members(user_id);
CREATE INDEX IF NOT EXISTS idx_school_members_school ON public.school_members(school_id);

CREATE OR REPLACE FUNCTION public.handle_new_school()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.school_members (school_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT (school_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_school_created ON public.schools;
CREATE TRIGGER on_school_created
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_school();

CREATE TABLE IF NOT EXISTS public.classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_classes_school ON public.classes(school_id);

DROP TRIGGER IF EXISTS classes_updated_at ON public.classes;
CREATE TRIGGER classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- students: admission_number + app contact fields; parent_id nullable (parent_students is canonical)
CREATE TABLE IF NOT EXISTS public.students (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id         uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  parent_id        uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  full_name        text NOT NULL,
  admission_number text,
  parent_name      text,
  parent_email     text,
  parent_phone     text,
  date_of_birth    date,
  gender           text CHECK (gender IN ('male', 'female', 'other')),
  status           public.student_status NOT NULL DEFAULT 'active',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, admission_number)
);

-- Legacy DBs: table may exist without class_id; CREATE TABLE IF NOT EXISTS skips DDL.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_students_school ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_parent ON public.students(parent_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);

DROP TRIGGER IF EXISTS students_updated_at ON public.students;
CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS parent_name text,
  ADD COLUMN IF NOT EXISTS parent_email text,
  ADD COLUMN IF NOT EXISTS parent_phone text;

DO $$
BEGIN
  ALTER TABLE public.students ALTER COLUMN parent_id DROP NOT NULL;
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN invalid_table_definition THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.fee_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  is_recurring boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_fee_types_school ON public.fee_types(school_id);

DROP TRIGGER IF EXISTS fee_types_updated_at ON public.fee_types;
CREATE TRIGGER fee_types_updated_at
  BEFORE UPDATE ON public.fee_types
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.fee_structures (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id    uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  amount      numeric(12, 2) NOT NULL CHECK (amount > 0),
  term        text NOT NULL,
  due_date    date,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Legacy DBs: fee_structures may exist without class_id.
ALTER TABLE public.fee_structures
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS fee_type_id uuid REFERENCES public.fee_types(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_fee_structures_school ON public.fee_structures(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_class ON public.fee_structures(class_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_fee_type ON public.fee_structures(fee_type_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_student ON public.fee_structures(student_id);

DROP TRIGGER IF EXISTS fee_structures_updated_at ON public.fee_structures;
CREATE TRIGGER fee_structures_updated_at
  BEFORE UPDATE ON public.fee_structures
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON COLUMN public.fee_structures.class_id IS
  'NULL means the fee applies to all classes in the school.';

-- payments: column names match app / types (payment_method, reference_number)
CREATE TABLE IF NOT EXISTS public.payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  fee_structure_id  uuid NOT NULL REFERENCES public.fee_structures(id) ON DELETE RESTRICT,
  amount            numeric(12, 2) NOT NULL CHECK (amount > 0),
  payment_method    public.payment_method NOT NULL,
  status            public.payment_status NOT NULL DEFAULT 'completed',
  payment_date      date NOT NULL DEFAULT CURRENT_DATE,
  reference_number  text,
  recorded_by       uuid NOT NULL REFERENCES public.profiles(id),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Upgrade path: legacy migrations used method + reference
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'method'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE public.payments RENAME COLUMN method TO payment_method;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'reference'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'reference_number'
  ) THEN
    ALTER TABLE public.payments RENAME COLUMN reference TO reference_number;
  END IF;
END $$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method,
  ADD COLUMN IF NOT EXISTS reference_number text;

-- If table was created empty without NOT NULL payment_method, backfill is not done here
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments'
      AND column_name = 'payment_method' AND is_nullable = 'YES'
  ) THEN
    UPDATE public.payments SET payment_method = 'cash' WHERE payment_method IS NULL;
    ALTER TABLE public.payments ALTER COLUMN payment_method SET NOT NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_fee_structure ON public.payments(fee_structure_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON public.payments(recorded_by);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.receipts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id     uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  receipt_number text NOT NULL UNIQUE,
  issued_at      timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_payment ON public.receipts(payment_id);

DROP TRIGGER IF EXISTS receipts_updated_at ON public.receipts;
CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE SEQUENCE IF NOT EXISTS public.receipt_seq;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.receipt_number := 'RCP-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.receipt_seq')::text, 5, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS receipts_generate_number ON public.receipts;
CREATE TRIGGER receipts_generate_number
  BEFORE INSERT ON public.receipts
  FOR EACH ROW
  WHEN (NEW.receipt_number IS NULL OR NEW.receipt_number = '')
  EXECUTE FUNCTION public.generate_receipt_number();

CREATE OR REPLACE VIEW public.student_fee_balances AS
SELECT
  s.id AS student_id,
  s.full_name AS student_name,
  s.school_id,
  s.class_id,
  s.parent_id,
  fs.id AS fee_structure_id,
  fs.name AS fee_name,
  fs.term,
  fs.amount AS total_fee,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS total_paid,
  fs.amount - COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS balance,
  fs.due_date
FROM public.students s
CROSS JOIN public.fee_structures fs
LEFT JOIN public.payments p
  ON p.student_id = s.id AND p.fee_structure_id = fs.id
WHERE fs.is_active = true
  AND s.status = 'active'
  AND (fs.class_id = s.class_id OR fs.class_id IS NULL)
  AND fs.school_id = s.school_id
  AND (fs.student_id IS NULL OR fs.student_id = s.id)
GROUP BY s.id, s.full_name, s.school_id, s.class_id, s.parent_id,
  fs.id, fs.name, fs.term, fs.amount, fs.due_date;

CREATE OR REPLACE VIEW public.fee_balances AS
SELECT * FROM public.student_fee_balances;

CREATE TABLE IF NOT EXISTS public.parent_students (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_students_parent ON public.parent_students(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON public.parent_students(student_id);

CREATE TABLE IF NOT EXISTS public.parent_link_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admission_number text NOT NULL,
  student_id       uuid REFERENCES public.students(id) ON DELETE CASCADE,
  school_id        uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plr_parent ON public.parent_link_requests(parent_id);
CREATE INDEX IF NOT EXISTS idx_plr_school ON public.parent_link_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_plr_status ON public.parent_link_requests(status);

DROP TRIGGER IF EXISTS parent_link_requests_updated_at ON public.parent_link_requests;
CREATE TRIGGER parent_link_requests_updated_at
  BEFORE UPDATE ON public.parent_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------- CLICKPESA (BillPay) ----------
CREATE TABLE IF NOT EXISTS public.clickpesa_fee_bills (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_structure_id uuid NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  parent_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  control_number   text,
  checkout_link    text,
  order_reference  text NOT NULL UNIQUE,
  amount           numeric(12, 2) NOT NULL CHECK (amount > 0),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clickpesa_fee_bills
  ALTER COLUMN control_number DROP NOT NULL;

ALTER TABLE public.clickpesa_fee_bills
  ADD COLUMN IF NOT EXISTS checkout_link text;

ALTER TABLE public.clickpesa_fee_bills
  DROP CONSTRAINT IF EXISTS clickpesa_fee_bills_has_payment_method;

ALTER TABLE public.clickpesa_fee_bills
  ADD CONSTRAINT clickpesa_fee_bills_has_payment_method
  CHECK (
    (control_number IS NOT NULL AND trim(control_number) <> '')
    OR (checkout_link IS NOT NULL AND trim(checkout_link) <> '')
  );

CREATE INDEX IF NOT EXISTS idx_clickpesa_bills_student ON public.clickpesa_fee_bills(student_id);
CREATE INDEX IF NOT EXISTS idx_clickpesa_bills_order_ref ON public.clickpesa_fee_bills(order_reference);

CREATE TABLE IF NOT EXISTS public.clickpesa_payment_transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clickpesa_bill_id  uuid NOT NULL REFERENCES public.clickpesa_fee_bills(id) ON DELETE CASCADE,
  payment_reference  text,
  amount             numeric(12, 2) NOT NULL,
  status             text NOT NULL DEFAULT 'success',
  raw_webhook        jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clickpesa_tx_bill ON public.clickpesa_payment_transactions(clickpesa_bill_id);

-- ---------- RLS HELPERS (after school_members + parent_students exist) ----------
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

CREATE OR REPLACE FUNCTION public.parent_student_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ps.student_id FROM public.parent_students ps
  WHERE ps.parent_id = auth.uid();
$$;

-- ---------- Visibility: admin can act on pending link row (school / student / admission) ----------
CREATE OR REPLACE FUNCTION public.admin_pending_parent_link_request_visible(
  p_school_id uuid,
  p_student_id uuid,
  p_admission_number text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (p_school_id IS NOT NULL AND public.is_school_admin(p_school_id))
    OR (
      p_student_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.students s
        WHERE s.id = p_student_id
          AND public.is_school_admin(s.school_id)
      )
    )
    OR (
      trim(COALESCE(p_admission_number, '')) <> ''
      AND EXISTS (
        SELECT 1
        FROM public.students s
        WHERE lower(trim(s.admission_number)) = lower(trim(COALESCE(p_admission_number, '')))
          AND trim(COALESCE(s.admission_number, '')) <> ''
          AND public.is_school_admin(s.school_id)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.admin_pending_parent_link_request_visible(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_pending_parent_link_request_visible(uuid, uuid, text) TO authenticated;

-- ---------- RPC: lookup student by admission (parent requests) ----------
DROP FUNCTION IF EXISTS public.lookup_student_by_admission(text);
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
  ORDER BY
    CASE
      WHEN p_prefer_school_id IS NOT NULL AND s.school_id = p_prefer_school_id THEN 0
      ELSE 1
    END,
    s.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_student_by_admission(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_student_by_admission(text, uuid) TO authenticated;

-- ---------- RPC: admin parent link requests (bypass RLS read issues) ----------
CREATE OR REPLACE FUNCTION public.get_pending_parent_link_requests_for_admin()
RETURNS TABLE (
  id uuid,
  parent_id uuid,
  admission_number text,
  student_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plr.id, plr.parent_id, plr.admission_number, plr.student_id, plr.created_at
  FROM public.parent_link_requests plr
  WHERE plr.status = 'pending'
    AND public.admin_pending_parent_link_request_visible(
      plr.school_id,
      plr.student_id,
      plr.admission_number
    )
  ORDER BY plr.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_pending_parent_link_requests_for_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_parent_link_requests_for_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_approve_parent_link_request(
  p_request_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.is_school_admin(
    (SELECT s.school_id FROM public.students s WHERE s.id = p_student_id LIMIT 1)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized for this student');
  END IF;

  SELECT plr.parent_id
  INTO v_parent_id
  FROM public.parent_link_requests plr
  WHERE plr.id = p_request_id
    AND plr.status = 'pending'
    AND public.admin_pending_parent_link_request_visible(
      plr.school_id,
      plr.student_id,
      plr.admission_number
    );

  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found or not authorized');
  END IF;

  INSERT INTO public.parent_students (parent_id, student_id)
  VALUES (v_parent_id, p_student_id)
  ON CONFLICT (parent_id, student_id) DO NOTHING;

  UPDATE public.parent_link_requests
  SET status = 'approved', updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_parent_link_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_parent_link_request(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reject_parent_link_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  UPDATE public.parent_link_requests plr
  SET status = 'rejected', updated_at = now()
  WHERE plr.id = p_request_id
    AND plr.status = 'pending'
    AND public.admin_pending_parent_link_request_visible(
      plr.school_id,
      plr.student_id,
      plr.admission_number
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found or not authorized');
  END IF;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reject_parent_link_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reject_parent_link_request(uuid) TO authenticated;

-- ---------- RPC: founding school (JWT-aware + currency) ----------
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

  -- Founding admin row is created by trigger public.on_school_created (handle_new_school).

  RETURN v_school_id;
END;
$$;

COMMENT ON FUNCTION public.create_founding_school(text, text, text, text, text, text) IS
  'Creates a school and links the current user as admin. Optional p_currency: TZS|KES|UGX|USD.';

REVOKE ALL ON FUNCTION public.create_founding_school(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_founding_school(text, text, text, text, text, text) TO authenticated;

-- ---------- RPC: get_my_school_id (00018) ----------
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

COMMENT ON FUNCTION public.get_my_school_id() IS
  'Returns school_id for auth.uid(): school_members first, else schools.created_by (orphan schools without membership row).';

REVOKE ALL ON FUNCTION public.get_my_school_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO authenticated;

-- =============================================================================
-- ROW LEVEL SECURITY — drop known policies then recreate (idempotent)
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clickpesa_fee_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clickpesa_payment_transactions ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read profiles in their schools" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view parent profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can read profiles in their schools"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT sm.user_id FROM public.school_members sm
      WHERE sm.school_id IN (SELECT public.user_school_ids())
    )
  );

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

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- schools
DROP POLICY IF EXISTS "Members can view their schools" ON public.schools;
DROP POLICY IF EXISTS "Admins select schools via is_school_admin" ON public.schools;
DROP POLICY IF EXISTS "Parents can view schools of linked students" ON public.schools;
DROP POLICY IF EXISTS "Authenticated users can create schools" ON public.schools;
DROP POLICY IF EXISTS "Admins can update their school" ON public.schools;
DROP POLICY IF EXISTS "Admins can delete their school" ON public.schools;

CREATE POLICY "Members can view their schools"
  ON public.schools FOR SELECT
  USING (id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins select schools via is_school_admin"
  ON public.schools FOR SELECT
  USING (public.is_school_admin(id));

CREATE POLICY "Parents can view schools of linked students"
  ON public.schools FOR SELECT
  USING (
    id IN (
      SELECT s.school_id
      FROM public.students s
      WHERE s.id IN (SELECT public.parent_student_ids())
    )
  );

CREATE POLICY "Authenticated users can create schools"
  ON public.schools FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update their school"
  ON public.schools FOR UPDATE
  USING (public.is_school_admin(id))
  WITH CHECK (public.is_school_admin(id));

CREATE POLICY "Admins can delete their school"
  ON public.schools FOR DELETE
  USING (public.is_school_admin(id));

-- school_members
DROP POLICY IF EXISTS "Users can view own memberships" ON public.school_members;
DROP POLICY IF EXISTS "Members can view co-members in their schools" ON public.school_members;
DROP POLICY IF EXISTS "Authenticated users can insert first membership" ON public.school_members;
DROP POLICY IF EXISTS "Admins can insert members" ON public.school_members;
DROP POLICY IF EXISTS "Admins can update members" ON public.school_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.school_members;

CREATE POLICY "Users can view own memberships"
  ON public.school_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Members can view co-members in their schools"
  ON public.school_members FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Authenticated users can insert first membership"
  ON public.school_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert members"
  ON public.school_members FOR INSERT
  WITH CHECK (public.is_school_admin(school_id));

CREATE POLICY "Admins can update members"
  ON public.school_members FOR UPDATE
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));

CREATE POLICY "Admins can remove members"
  ON public.school_members FOR DELETE
  USING (public.is_school_admin(school_id));

-- classes
DROP POLICY IF EXISTS "Members can view classes" ON public.classes;
DROP POLICY IF EXISTS "Members can view classes in their schools" ON public.classes;
DROP POLICY IF EXISTS "Admins select classes via is_school_admin" ON public.classes;
DROP POLICY IF EXISTS "Admins can create classes" ON public.classes;
DROP POLICY IF EXISTS "Admins can update classes" ON public.classes;
DROP POLICY IF EXISTS "Admins can delete classes" ON public.classes;
DROP POLICY IF EXISTS "Parents can view classes for linked students" ON public.classes;

CREATE POLICY "Members can view classes"
  ON public.classes FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins select classes via is_school_admin"
  ON public.classes FOR SELECT
  USING (public.is_school_admin(school_id));

CREATE POLICY "Admins can create classes"
  ON public.classes FOR INSERT
  WITH CHECK (public.is_school_admin(school_id));

CREATE POLICY "Admins can update classes"
  ON public.classes FOR UPDATE
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));

CREATE POLICY "Admins can delete classes"
  ON public.classes FOR DELETE
  USING (public.is_school_admin(school_id));

CREATE POLICY "Parents can view classes for linked students"
  ON public.classes FOR SELECT
  USING (
    id IN (
      SELECT s.class_id FROM public.students s
      WHERE s.id IN (SELECT public.parent_student_ids())
    )
  );

-- students
DROP POLICY IF EXISTS "Admins can view students" ON public.students;
DROP POLICY IF EXISTS "Admins can view students in their schools" ON public.students;
DROP POLICY IF EXISTS "Parents can view own children" ON public.students;
DROP POLICY IF EXISTS "Parents can view linked students" ON public.students;
DROP POLICY IF EXISTS "Admins can create students" ON public.students;
DROP POLICY IF EXISTS "Admins can update students" ON public.students;
DROP POLICY IF EXISTS "Admins can delete students" ON public.students;

CREATE POLICY "Admins can view students"
  ON public.students FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Parents can view linked students"
  ON public.students FOR SELECT
  USING (id IN (SELECT public.parent_student_ids()));

CREATE POLICY "Admins can create students"
  ON public.students FOR INSERT
  WITH CHECK (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins can update students"
  ON public.students FOR UPDATE
  USING (school_id IN (SELECT public.user_school_ids()))
  WITH CHECK (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins can delete students"
  ON public.students FOR DELETE
  USING (school_id IN (SELECT public.user_school_ids()));

-- fee_types
DROP POLICY IF EXISTS "Members can view fee types" ON public.fee_types;
DROP POLICY IF EXISTS "Admins can create fee types" ON public.fee_types;
DROP POLICY IF EXISTS "Admins can update fee types" ON public.fee_types;
DROP POLICY IF EXISTS "Admins can delete fee types" ON public.fee_types;
DROP POLICY IF EXISTS "Admins select fee_types via is_school_admin" ON public.fee_types;
DROP POLICY IF EXISTS "Admins insert fee_types via is_school_admin" ON public.fee_types;
DROP POLICY IF EXISTS "Admins update fee_types via is_school_admin" ON public.fee_types;
DROP POLICY IF EXISTS "Admins delete fee_types via is_school_admin" ON public.fee_types;

CREATE POLICY "Members can view fee types"
  ON public.fee_types FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins select fee_types via is_school_admin"
  ON public.fee_types FOR SELECT
  USING (public.is_school_admin(school_id));

CREATE POLICY "Admins can create fee types"
  ON public.fee_types FOR INSERT
  WITH CHECK (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins insert fee_types via is_school_admin"
  ON public.fee_types FOR INSERT
  WITH CHECK (public.is_school_admin(school_id));

CREATE POLICY "Admins can update fee types"
  ON public.fee_types FOR UPDATE
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins update fee_types via is_school_admin"
  ON public.fee_types FOR UPDATE
  USING (public.is_school_admin(school_id));

CREATE POLICY "Admins can delete fee types"
  ON public.fee_types FOR DELETE
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins delete fee_types via is_school_admin"
  ON public.fee_types FOR DELETE
  USING (public.is_school_admin(school_id));

-- fee_structures
DROP POLICY IF EXISTS "Members can view fee structures" ON public.fee_structures;
DROP POLICY IF EXISTS "Admins can view fee structures" ON public.fee_structures;
DROP POLICY IF EXISTS "Parents can view fee structures" ON public.fee_structures;
DROP POLICY IF EXISTS "Admins can create fee structures" ON public.fee_structures;
DROP POLICY IF EXISTS "Admins can update fee structures" ON public.fee_structures;
DROP POLICY IF EXISTS "Admins can delete fee structures" ON public.fee_structures;
DROP POLICY IF EXISTS "Parents can view fee structures for linked students" ON public.fee_structures;

CREATE POLICY "Members can view fee structures"
  ON public.fee_structures FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins can create fee structures"
  ON public.fee_structures FOR INSERT
  WITH CHECK (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins can update fee structures"
  ON public.fee_structures FOR UPDATE
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins can delete fee structures"
  ON public.fee_structures FOR DELETE
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Parents can view fee structures for linked students"
  ON public.fee_structures FOR SELECT
  USING (
    id IN (
      SELECT DISTINCT sfb.fee_structure_id
      FROM public.student_fee_balances sfb
      WHERE sfb.student_id IN (SELECT public.parent_student_ids())
    )
    OR class_id IN (
      SELECT s.class_id FROM public.students s
      WHERE s.id IN (SELECT public.parent_student_ids())
    )
    OR student_id IN (SELECT public.parent_student_ids())
  );

-- payments
DROP POLICY IF EXISTS "Admins can view payments" ON public.payments;
DROP POLICY IF EXISTS "Parents can view payments" ON public.payments;
DROP POLICY IF EXISTS "Parents can view payments for linked students" ON public.payments;
DROP POLICY IF EXISTS "Admins can record payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;

CREATE POLICY "Admins can view payments"
  ON public.payments FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE school_id IN (SELECT public.user_school_ids())
    )
  );

CREATE POLICY "Parents can view payments for linked students"
  ON public.payments FOR SELECT
  USING (student_id IN (SELECT public.parent_student_ids()));

CREATE POLICY "Admins can record payments"
  ON public.payments FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM public.students
      WHERE school_id IN (SELECT public.user_school_ids())
    )
  );

CREATE POLICY "Admins can update payments"
  ON public.payments FOR UPDATE
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE school_id IN (SELECT public.user_school_ids())
    )
  );

CREATE POLICY "Admins can delete payments"
  ON public.payments FOR DELETE
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE school_id IN (SELECT public.user_school_ids())
    )
  );

-- receipts
DROP POLICY IF EXISTS "Admins can view receipts" ON public.receipts;
DROP POLICY IF EXISTS "Parents can view receipts" ON public.receipts;
DROP POLICY IF EXISTS "Parents can view receipts for linked students" ON public.receipts;
DROP POLICY IF EXISTS "Admins can create receipts" ON public.receipts;
DROP POLICY IF EXISTS "Admins can update receipts" ON public.receipts;

CREATE POLICY "Admins can view receipts"
  ON public.receipts FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM public.payments
      WHERE student_id IN (
        SELECT id FROM public.students
        WHERE school_id IN (SELECT public.user_school_ids())
      )
    )
  );

CREATE POLICY "Parents can view receipts for linked students"
  ON public.receipts FOR SELECT
  USING (
    payment_id IN (
      SELECT p.id FROM public.payments p
      WHERE p.student_id IN (SELECT public.parent_student_ids())
    )
  );

CREATE POLICY "Admins can create receipts"
  ON public.receipts FOR INSERT
  WITH CHECK (
    payment_id IN (
      SELECT id FROM public.payments
      WHERE student_id IN (
        SELECT id FROM public.students
        WHERE school_id IN (SELECT public.user_school_ids())
      )
    )
  );

CREATE POLICY "Admins can update receipts"
  ON public.receipts FOR UPDATE
  USING (
    payment_id IN (
      SELECT p.id FROM public.payments p
      JOIN public.students s ON s.id = p.student_id
      WHERE public.is_school_admin(s.school_id)
    )
  );

-- parent_students
DROP POLICY IF EXISTS "Parents can view own links" ON public.parent_students;
DROP POLICY IF EXISTS "Admins can view parent_students" ON public.parent_students;
DROP POLICY IF EXISTS "Admins can insert parent_students" ON public.parent_students;
DROP POLICY IF EXISTS "Admins can delete parent_students" ON public.parent_students;
DROP POLICY IF EXISTS "Admins select parent_students via is_school_admin" ON public.parent_students;
DROP POLICY IF EXISTS "Admins insert parent_students via is_school_admin" ON public.parent_students;
DROP POLICY IF EXISTS "Admins delete parent_students via is_school_admin" ON public.parent_students;

CREATE POLICY "Parents can view own links"
  ON public.parent_students FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Admins can view parent_students"
  ON public.parent_students FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.school_id IN (SELECT public.user_school_ids())
    )
  );

CREATE POLICY "Admins select parent_students via is_school_admin"
  ON public.parent_students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = parent_students.student_id
        AND public.is_school_admin(s.school_id)
    )
  );

CREATE POLICY "Admins can insert parent_students"
  ON public.parent_students FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.school_id IN (SELECT public.user_school_ids())
    )
  );

CREATE POLICY "Admins insert parent_students via is_school_admin"
  ON public.parent_students FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = parent_students.student_id
        AND public.is_school_admin(s.school_id)
    )
  );

CREATE POLICY "Admins can delete parent_students"
  ON public.parent_students FOR DELETE
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.school_id IN (SELECT public.user_school_ids())
    )
  );

CREATE POLICY "Admins delete parent_students via is_school_admin"
  ON public.parent_students FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = parent_students.student_id
        AND public.is_school_admin(s.school_id)
    )
  );

-- parent_link_requests
DROP POLICY IF EXISTS "Parents can view own requests" ON public.parent_link_requests;
DROP POLICY IF EXISTS "Parents can insert own requests" ON public.parent_link_requests;
DROP POLICY IF EXISTS "Admins can view school requests" ON public.parent_link_requests;
DROP POLICY IF EXISTS "Admins can update school requests" ON public.parent_link_requests;
DROP POLICY IF EXISTS "Admins select link requests via is_school_admin" ON public.parent_link_requests;
DROP POLICY IF EXISTS "Admins update link requests via is_school_admin" ON public.parent_link_requests;
DROP POLICY IF EXISTS "Admins select link requests via student school" ON public.parent_link_requests;
DROP POLICY IF EXISTS "Admins update link requests via student school" ON public.parent_link_requests;
DROP POLICY IF EXISTS "Admins select pending link requests definer visibility" ON public.parent_link_requests;
DROP POLICY IF EXISTS "Admins update pending link requests definer visibility" ON public.parent_link_requests;
DROP POLICY IF EXISTS "Parents delete own pending requests" ON public.parent_link_requests;

CREATE POLICY "Parents can view own requests"
  ON public.parent_link_requests FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can insert own requests"
  ON public.parent_link_requests FOR INSERT
  WITH CHECK (
    parent_id = auth.uid()
    AND school_id IS NOT NULL
    AND student_id IS NOT NULL
  );

CREATE POLICY "Admins can view school requests"
  ON public.parent_link_requests FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins can update school requests"
  ON public.parent_link_requests FOR UPDATE
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Admins select link requests via is_school_admin"
  ON public.parent_link_requests FOR SELECT
  USING (public.is_school_admin(school_id));

CREATE POLICY "Admins update link requests via is_school_admin"
  ON public.parent_link_requests FOR UPDATE
  USING (public.is_school_admin(school_id));

CREATE POLICY "Admins select link requests via student school"
  ON public.parent_link_requests FOR SELECT
  USING (
    student_id IS NOT NULL
    AND public.is_school_admin(
      (SELECT s.school_id FROM public.students s WHERE s.id = parent_link_requests.student_id LIMIT 1)
    )
  );

CREATE POLICY "Admins update link requests via student school"
  ON public.parent_link_requests FOR UPDATE
  USING (
    student_id IS NOT NULL
    AND public.is_school_admin(
      (SELECT s.school_id FROM public.students s WHERE s.id = parent_link_requests.student_id LIMIT 1)
    )
  );

CREATE POLICY "Admins select pending link requests definer visibility"
  ON public.parent_link_requests FOR SELECT
  USING (
    status = 'pending'
    AND public.admin_pending_parent_link_request_visible(school_id, student_id, admission_number)
  );

CREATE POLICY "Admins update pending link requests definer visibility"
  ON public.parent_link_requests FOR UPDATE
  USING (
    status = 'pending'
    AND public.admin_pending_parent_link_request_visible(school_id, student_id, admission_number)
  )
  WITH CHECK (
    public.admin_pending_parent_link_request_visible(school_id, student_id, admission_number)
  );

CREATE POLICY "Parents delete own pending requests"
  ON public.parent_link_requests FOR DELETE
  USING (parent_id = auth.uid() AND status = 'pending');

-- clickpesa_fee_bills
DROP POLICY IF EXISTS "Parents can view own ClickPesa bills" ON public.clickpesa_fee_bills;
DROP POLICY IF EXISTS "Parents can insert own ClickPesa bills" ON public.clickpesa_fee_bills;

CREATE POLICY "Parents can view own ClickPesa bills"
  ON public.clickpesa_fee_bills FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can insert own ClickPesa bills"
  ON public.clickpesa_fee_bills FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- clickpesa_payment_transactions: webhook uses service_role only (no authenticated policies)

-- Repair founding admins missing school_members (school inserted before trigger, etc.)
INSERT INTO public.school_members (school_id, user_id, role)
SELECT s.id, s.created_by, 'admin'::public.user_role
FROM public.schools s
WHERE NOT EXISTS (
  SELECT 1 FROM public.school_members sm
  WHERE sm.school_id = s.id AND sm.user_id = s.created_by
)
ON CONFLICT (school_id, user_id) DO NOTHING;

-- =============================================================================
-- GRANTS
-- =============================================================================
GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.schools TO authenticated;
GRANT ALL ON public.school_members TO authenticated;
GRANT ALL ON public.classes TO authenticated;
GRANT ALL ON public.students TO authenticated;
GRANT ALL ON public.fee_types TO authenticated;
GRANT ALL ON public.fee_structures TO authenticated;
GRANT ALL ON public.payments TO authenticated;
GRANT ALL ON public.receipts TO authenticated;
GRANT ALL ON public.parent_students TO authenticated;
GRANT ALL ON public.parent_link_requests TO authenticated;

GRANT SELECT, INSERT ON public.clickpesa_fee_bills TO authenticated;
GRANT ALL ON public.clickpesa_fee_bills TO service_role;
GRANT ALL ON public.clickpesa_payment_transactions TO service_role;

GRANT SELECT ON public.student_fee_balances TO authenticated;
GRANT SELECT ON public.fee_balances TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT ON public.receipts TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.receipt_seq TO authenticated;

GRANT SELECT ON public.profiles TO anon;

GRANT EXECUTE ON FUNCTION public.get_school_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_school_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.parent_student_ids() TO authenticated;
