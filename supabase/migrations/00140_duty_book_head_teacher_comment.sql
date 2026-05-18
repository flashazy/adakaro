-- Head teacher optional comment on daily duty book report (saved at sign-off).

ALTER TABLE public.duty_book_reports
  ADD COLUMN IF NOT EXISTS head_teacher_comment text;

COMMENT ON COLUMN public.duty_book_reports.head_teacher_comment IS
  'Optional official note from the head teacher when signing the daily duty book report.';
