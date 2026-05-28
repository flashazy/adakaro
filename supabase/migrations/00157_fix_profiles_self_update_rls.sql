-- Fix infinite recursion on profiles when users update their own row (e.g. change-password).
-- Re-create the self-update policy with a simple auth.uid() check only.

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
