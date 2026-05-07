-- Quick QR Desk: temporary enrollment helpers created without manual username setup.

ALTER TABLE public.capture_card_users
  ADD COLUMN IF NOT EXISTS is_quick_qr_user boolean NOT NULL DEFAULT false;

ALTER TABLE public.capture_card_users
  ADD COLUMN IF NOT EXISTS quick_qr_label text;

ALTER TABLE public.capture_card_users
  ADD COLUMN IF NOT EXISTS quick_qr_note text;

COMMENT ON COLUMN public.capture_card_users.is_quick_qr_user IS
  'True when this row was created via Quick QR Desk (vs manual admin setup).';

COMMENT ON COLUMN public.capture_card_users.quick_qr_label IS
  'Human-friendly label shown to admins (e.g. Reception, Desk 1).';

COMMENT ON COLUMN public.capture_card_users.quick_qr_note IS
  'Optional admin note for this quick desk (not shown to helpers).';
