-- Harden demo_requests access: public may INSERT only; no public SELECT.

REVOKE ALL ON TABLE public.demo_requests FROM anon;
GRANT INSERT ON TABLE public.demo_requests TO anon;

-- Authenticated users may INSERT (contact form) but RLS limits SELECT/UPDATE/DELETE to super admins.
REVOKE ALL ON TABLE public.demo_requests FROM authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.demo_requests TO authenticated;

-- Ensure insert policy exists (idempotent).
DROP POLICY IF EXISTS "Public insert demo_requests" ON public.demo_requests;
CREATE POLICY "Public insert demo_requests"
  ON public.demo_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'New'
    AND source = 'contact_page'
  );

DROP POLICY IF EXISTS "Super admins select demo_requests" ON public.demo_requests;
CREATE POLICY "Super admins select demo_requests"
  ON public.demo_requests FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update demo_requests" ON public.demo_requests;
CREATE POLICY "Super admins update demo_requests"
  ON public.demo_requests FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins delete demo_requests" ON public.demo_requests;
CREATE POLICY "Super admins delete demo_requests"
  ON public.demo_requests FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

COMMENT ON POLICY "Public insert demo_requests" ON public.demo_requests IS
  'Marketing Contact form: insert-only for anon/authenticated. No public SELECT — server uses service_role for RETURNING.';
