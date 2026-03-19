-- ============================================================
-- Allow school admins to view parent profiles so they can
-- link them to students on the parent-links page.
--
-- Without this, RLS on profiles blocks admins from seeing
-- any user who isn't a school_member.
-- ============================================================

DROP POLICY IF EXISTS "Admins can view parent profiles" ON public.profiles;

CREATE POLICY "Admins can view parent profiles"
  ON public.profiles FOR SELECT
  USING (
    role = 'parent'
    AND EXISTS (
      SELECT 1 FROM public.school_members sm
      WHERE sm.user_id = auth.uid()
    )
  );
