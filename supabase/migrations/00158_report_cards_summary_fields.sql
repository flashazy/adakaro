-- Store reusable report card summary values (for promotions / dashboards).
-- Avoid term-specific columns; these apply to any term.

ALTER TABLE public.report_cards
  ADD COLUMN IF NOT EXISTS total_score numeric,
  ADD COLUMN IF NOT EXISTS average_score numeric,
  ADD COLUMN IF NOT EXISTS subjects_count integer,
  ADD COLUMN IF NOT EXISTS completed_subjects_count integer,
  ADD COLUMN IF NOT EXISTS is_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS summary_calculated_at timestamptz;

-- Fast lookup for promotions modal (by class/term/year).
CREATE INDEX IF NOT EXISTS idx_report_cards_promotion_lookup
  ON public.report_cards (school_id, class_id, academic_year, term);

-- Optional: enables fast ordering/filtering by computed average.
CREATE INDEX IF NOT EXISTS idx_report_cards_average_lookup
  ON public.report_cards (school_id, class_id, academic_year, term, average_score);

