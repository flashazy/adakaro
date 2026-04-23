-- Admin-initiated teacher password reset: force change on next login + audit log.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_forced_reset boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS teacher_temp_password_expires_at timestamptz;

COMMENT ON COLUMN public.profiles.password_forced_reset IS
  'When true, teacher must set a new password (e.g. after admin reset).';
COMMENT ON COLUMN public.profiles.teacher_temp_password_expires_at IS
  'After admin issues a temp password, login is blocked after this time until a new admin reset.';

CREATE TABLE IF NOT EXISTS public.password_reset_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_logs_teacher_id_idx
  ON public.password_reset_logs (teacher_id);
CREATE INDEX IF NOT EXISTS password_reset_logs_created_at_idx
  ON public.password_reset_logs (created_at DESC);

ALTER TABLE public.password_reset_logs ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (bypass) used from server actions; end users do not read this table.

COMMENT ON TABLE public.password_reset_logs IS
  'Audit log when a school admin resets a teacher password (no password values stored).';
