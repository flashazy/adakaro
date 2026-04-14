-- Persist gradebook override metadata for report card exam scores (PDF / reload).
ALTER TABLE public.teacher_report_card_comments
  ADD COLUMN IF NOT EXISTS exam1_gradebook_original numeric(5, 2),
  ADD COLUMN IF NOT EXISTS exam2_gradebook_original numeric(5, 2),
  ADD COLUMN IF NOT EXISTS exam1_score_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exam2_score_overridden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.teacher_report_card_comments.exam1_gradebook_original IS
  'When exam1 was overridden after gradebook autofill, the gradebook percentage that was replaced.';
COMMENT ON COLUMN public.teacher_report_card_comments.exam2_gradebook_original IS
  'When exam2 was overridden after gradebook autofill, the gradebook percentage that was replaced.';
