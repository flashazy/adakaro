-- Ensure capture_card_users supports bcrypt-based auth.
-- This keeps legacy columns (auth_email/auth_user_id) intact for backwards compatibility.

ALTER TABLE public.capture_card_users
  ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE public.capture_card_users
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.capture_card_users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Required columns already exist in 00119 on new databases:
--   (id, username, password_hash, school_id, is_active, expires_at)

