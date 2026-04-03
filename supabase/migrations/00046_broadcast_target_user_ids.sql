-- Optional targeting: when set, only these school admins see the broadcast (e.g. reminders).

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS target_user_ids uuid[] NULL;

COMMENT ON COLUMN public.broadcasts.target_user_ids IS
  'When non-null and non-empty, only these users receive the broadcast; otherwise all school admins.';
