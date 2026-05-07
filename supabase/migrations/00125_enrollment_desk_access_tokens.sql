-- Short-lived QR access tokens for Enrollment Desk (capture_card_users).
-- Only token_hash is stored; raw token is shown once at generation.
-- Server-side redemption uses service_role; RLS blocks direct client access.

CREATE TABLE IF NOT EXISTS public.enrollment_desk_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_card_user_id uuid NOT NULL REFERENCES public.capture_card_users (id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_desk_access_tokens_token_hash
  ON public.enrollment_desk_access_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_enrollment_desk_access_tokens_ccu_school
  ON public.enrollment_desk_access_tokens (capture_card_user_id, school_id);

CREATE INDEX IF NOT EXISTS idx_enrollment_desk_access_tokens_school_expires
  ON public.enrollment_desk_access_tokens (school_id, expires_at)
  WHERE revoked_at IS NULL AND used_at IS NULL;

ALTER TABLE public.enrollment_desk_access_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.enrollment_desk_access_tokens IS
  'Hashed one-time QR tokens for Enrollment Desk login; redeemed via server only.';

GRANT SELECT, INSERT, UPDATE ON TABLE public.enrollment_desk_access_tokens TO authenticated;
GRANT ALL ON TABLE public.enrollment_desk_access_tokens TO service_role;

CREATE POLICY enrollment_desk_access_tokens_select
  ON public.enrollment_desk_access_tokens
  FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY enrollment_desk_access_tokens_insert
  ON public.enrollment_desk_access_tokens
  FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY enrollment_desk_access_tokens_update
  ON public.enrollment_desk_access_tokens
  FOR UPDATE TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());
