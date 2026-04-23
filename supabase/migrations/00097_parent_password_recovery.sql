-- Parent password recovery: on-screen 6-digit codes (no SMS/email).
-- Service role + server actions only; RLS enabled with no user policies.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recovery_reset_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.recovery_reset_required IS
  'Set true after parent recovers account via admission+phone; must set new password on /reset-password.';

CREATE TABLE public.password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  admission_number text NOT NULL,
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_reset_codes_parent_id_idx
  ON public.password_reset_codes (parent_id);
CREATE INDEX password_reset_codes_expires_idx
  ON public.password_reset_codes (expires_at)
  WHERE used_at IS NULL;

COMMENT ON TABLE public.password_reset_codes IS
  'Single-use 6-digit recovery codes; deleted after successful verification.';

-- Rate limit: 3 code issuances per IP per hour (see app server actions).
CREATE TABLE public.parent_recovery_rate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX parent_recovery_rate_events_ip_created_idx
  ON public.parent_recovery_rate_events (ip, created_at);

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_recovery_rate_events ENABLE ROW LEVEL SECURITY;
