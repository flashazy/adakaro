-- Allow any authenticated member (or school creator) to SELECT their school row
-- without going through user_school_ids(). Fixes missing name/currency when
-- nested helpers or policy evaluation behaved inconsistently for some accounts.

DROP POLICY IF EXISTS "Members can read school row by membership" ON public.schools;
CREATE POLICY "Members can read school row by membership"
  ON public.schools FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.school_members sm
      WHERE sm.school_id = schools.id
        AND sm.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Members can read school row by membership" ON public.schools IS
  'Direct membership (or creator) check so admins always read schools.name and schools.currency.';
