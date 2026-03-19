-- ============================================================
-- Fix: RLS policies on parent_link_requests.
--
-- The original policies used user_school_ids() which, despite
-- working on other tables, returns empty for this table's
-- policy evaluation. Replace with a direct subquery against
-- school_members to avoid any function-based RLS issues.
-- ============================================================

-- Ensure RLS is enabled
ALTER TABLE public.parent_link_requests ENABLE ROW LEVEL SECURITY;

-- ---- Parent policies (re-create to be safe) ----

DROP POLICY IF EXISTS "Parents can view own requests" ON public.parent_link_requests;
CREATE POLICY "Parents can view own requests"
  ON public.parent_link_requests FOR SELECT
  USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "Parents can insert own requests" ON public.parent_link_requests;
CREATE POLICY "Parents can insert own requests"
  ON public.parent_link_requests FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- ---- Admin policies (direct subquery, no helper function) ----

DROP POLICY IF EXISTS "Admins can view school requests" ON public.parent_link_requests;
CREATE POLICY "Admins can view school requests"
  ON public.parent_link_requests FOR SELECT
  USING (
    school_id IN (
      SELECT sm.school_id
      FROM public.school_members sm
      WHERE sm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update school requests" ON public.parent_link_requests;
CREATE POLICY "Admins can update school requests"
  ON public.parent_link_requests FOR UPDATE
  USING (
    school_id IN (
      SELECT sm.school_id
      FROM public.school_members sm
      WHERE sm.user_id = auth.uid()
    )
  );

-- Ensure grants
GRANT ALL ON public.parent_link_requests TO authenticated;
