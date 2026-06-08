-- Notification inbox states: unread (default), read (read_at set), archived (archived_at set).
-- Teachers archive to clear their inbox without deleting school activity records.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.notifications.archived_at IS
  'When set, the notification is archived (hidden from inbox, never deleted).';

COMMENT ON COLUMN public.notifications.read_at IS
  'When set, the notification has been read (still visible in inbox until archived).';

DROP INDEX IF EXISTS idx_notifications_recipient_unread;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id)
  WHERE read_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_inbox
  ON public.notifications (recipient_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_archived
  ON public.notifications (recipient_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;
