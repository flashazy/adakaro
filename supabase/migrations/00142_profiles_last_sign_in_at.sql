-- Track when a user last signed in (for duty rotation and active-teacher filters).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

COMMENT ON COLUMN public.profiles.last_sign_in_at IS
  'Last successful sign-in; NULL until the user has logged in at least once.';

-- Backfill from Supabase Auth (existing sessions).
UPDATE public.profiles p
SET last_sign_in_at = u.last_sign_in_at
FROM auth.users u
WHERE p.id = u.id
  AND u.last_sign_in_at IS NOT NULL
  AND p.last_sign_in_at IS NULL;
