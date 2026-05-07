-- First-login password change for auto-provisioned parent accounts (paper credentials).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.must_change_password IS
  'When true, parent must change password at /change-password before dashboard. Cleared after successful update.';
