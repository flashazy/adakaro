-- Teachers/parents must read their own profile row for forced-password middleware and login.
-- Removed indirectly when admin-only SELECT policies were consolidated (00145/00149).

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());
