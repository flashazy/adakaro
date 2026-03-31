-- School suspension: status + suspension_reason, helpers, restrictive RLS, middleware RPC

-- ---------------------------------------------------------------------------
-- 1) Enum + columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.school_status AS ENUM ('active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS status public.school_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspension_reason text;

COMMENT ON COLUMN public.schools.status IS
  'active = normal access; suspended = block all school users (not platform super admins).';
COMMENT ON COLUMN public.schools.suspension_reason IS
  'Optional note set when a super admin suspends the school.';

-- ---------------------------------------------------------------------------
-- 2) Helpers (SECURITY DEFINER + row_security off — avoid RLS recursion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.school_is_operational(p_school_id uuid)
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
  )
  OR (
    p_school_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.schools s
      WHERE s.id = p_school_id
        AND s.status = 'active'::public.school_status
    )
  );
$$;

REVOKE ALL ON FUNCTION public.school_is_operational(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_is_operational(uuid) TO authenticated;

COMMENT ON FUNCTION public.school_is_operational(uuid) IS
  'True if school is active, or current user is super_admin (can manage suspended schools).';

CREATE OR REPLACE FUNCTION public.is_user_blocked_by_school_suspension()
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
  )
  IS FALSE
  AND (
    EXISTS (
      SELECT 1
      FROM public.school_members sm
      INNER JOIN public.schools s ON s.id = sm.school_id
      WHERE sm.user_id = auth.uid()
        AND s.status = 'suspended'::public.school_status
    )
    OR EXISTS (
      SELECT 1
      FROM public.schools s
      WHERE s.created_by = auth.uid()
        AND s.status = 'suspended'::public.school_status
    )
    OR EXISTS (
      SELECT 1
      FROM public.parent_students ps
      INNER JOIN public.students st ON st.id = ps.student_id
      INNER JOIN public.schools s ON s.id = st.school_id
      WHERE ps.parent_id = auth.uid()
        AND s.status = 'suspended'::public.school_status
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_user_blocked_by_school_suspension() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_blocked_by_school_suspension() TO authenticated;

COMMENT ON FUNCTION public.is_user_blocked_by_school_suspension() IS
  'True when the current user is tied to a suspended school (not super_admin). Used by app middleware.';

-- ---------------------------------------------------------------------------
-- 3) RESTRICTIVE policies — must pass for all operations (AND with permissive)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "restrictive_school_operational" ON public.schools;
CREATE POLICY "restrictive_school_operational"
  ON public.schools
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.school_is_operational(id))
  WITH CHECK (public.school_is_operational(id));

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.school_members;
CREATE POLICY "restrictive_school_operational"
  ON public.school_members
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.school_is_operational(school_id))
  WITH CHECK (public.school_is_operational(school_id));

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.school_invitations;
CREATE POLICY "restrictive_school_operational"
  ON public.school_invitations
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.school_is_operational(school_id))
  WITH CHECK (public.school_is_operational(school_id));

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.school_admission_counters;
CREATE POLICY "restrictive_school_operational"
  ON public.school_admission_counters
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.school_is_operational(school_id))
  WITH CHECK (public.school_is_operational(school_id));

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.upgrade_requests;
CREATE POLICY "restrictive_school_operational"
  ON public.upgrade_requests
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.school_is_operational(school_id))
  WITH CHECK (public.school_is_operational(school_id));

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.classes;
CREATE POLICY "restrictive_school_operational"
  ON public.classes
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.school_is_operational(school_id))
  WITH CHECK (public.school_is_operational(school_id));

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.students;
CREATE POLICY "restrictive_school_operational"
  ON public.students
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.school_is_operational(school_id))
  WITH CHECK (public.school_is_operational(school_id));

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.fee_types;
CREATE POLICY "restrictive_school_operational"
  ON public.fee_types
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.school_is_operational(school_id))
  WITH CHECK (public.school_is_operational(school_id));

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.fee_structures;
CREATE POLICY "restrictive_school_operational"
  ON public.fee_structures
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.school_is_operational(school_id))
  WITH CHECK (public.school_is_operational(school_id));

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.parent_link_requests;
CREATE POLICY "restrictive_school_operational"
  ON public.parent_link_requests
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.school_is_operational(
      COALESCE(
        parent_link_requests.school_id,
        (
          SELECT st.school_id
          FROM public.students st
          WHERE st.id = parent_link_requests.student_id
          LIMIT 1
        )
      )
    )
  )
  WITH CHECK (
    public.school_is_operational(
      COALESCE(
        parent_link_requests.school_id,
        (
          SELECT st.school_id
          FROM public.students st
          WHERE st.id = parent_link_requests.student_id
          LIMIT 1
        )
      )
    )
  );

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.payments;
CREATE POLICY "restrictive_school_operational"
  ON public.payments
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.school_is_operational(
      (
        SELECT st.school_id
        FROM public.students st
        WHERE st.id = payments.student_id
        LIMIT 1
      )
    )
  )
  WITH CHECK (
    public.school_is_operational(
      (
        SELECT st.school_id
        FROM public.students st
        WHERE st.id = payments.student_id
        LIMIT 1
      )
    )
  );

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.receipts;
CREATE POLICY "restrictive_school_operational"
  ON public.receipts
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.school_is_operational(
      (
        SELECT st.school_id
        FROM public.payments p
        INNER JOIN public.students st ON st.id = p.student_id
        WHERE p.id = receipts.payment_id
        LIMIT 1
      )
    )
  )
  WITH CHECK (
    public.school_is_operational(
      (
        SELECT st.school_id
        FROM public.payments p
        INNER JOIN public.students st ON st.id = p.student_id
        WHERE p.id = receipts.payment_id
        LIMIT 1
      )
    )
  );

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.parent_students;
CREATE POLICY "restrictive_school_operational"
  ON public.parent_students
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.school_is_operational(
      (
        SELECT st.school_id
        FROM public.students st
        WHERE st.id = parent_students.student_id
        LIMIT 1
      )
    )
  )
  WITH CHECK (
    public.school_is_operational(
      (
        SELECT st.school_id
        FROM public.students st
        WHERE st.id = parent_students.student_id
        LIMIT 1
      )
    )
  );

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.clickpesa_fee_bills;
CREATE POLICY "restrictive_school_operational"
  ON public.clickpesa_fee_bills
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.school_is_operational(
      (
        SELECT st.school_id
        FROM public.students st
        WHERE st.id = clickpesa_fee_bills.student_id
        LIMIT 1
      )
    )
  )
  WITH CHECK (
    public.school_is_operational(
      (
        SELECT st.school_id
        FROM public.students st
        WHERE st.id = clickpesa_fee_bills.student_id
        LIMIT 1
      )
    )
  );

DROP POLICY IF EXISTS "restrictive_school_operational" ON public.azampay_pending_payments;
CREATE POLICY "restrictive_school_operational"
  ON public.azampay_pending_payments
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.school_is_operational(
      (
        SELECT st.school_id
        FROM public.students st
        WHERE st.id = azampay_pending_payments.student_id
        LIMIT 1
      )
    )
  )
  WITH CHECK (
    public.school_is_operational(
      (
        SELECT st.school_id
        FROM public.students st
        WHERE st.id = azampay_pending_payments.student_id
        LIMIT 1
      )
    )
  );
