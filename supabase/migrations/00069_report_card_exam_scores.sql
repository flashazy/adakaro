-- Tanzania-style report card: two exam percentages per term + calculated average.

ALTER TABLE public.teacher_report_card_comments
  ADD COLUMN IF NOT EXISTS exam1_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS exam2_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS calculated_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS calculated_grade text;
