-- Persist subject position (class rank) on each report-card comment row so the
-- coordinator's bulk-generated report cards carry a position even when the
-- live preview-time computation cannot rank (e.g. mismatched subject labels
-- across teachers, or no scores available at view time).
ALTER TABLE public.teacher_report_card_comments
  ADD COLUMN IF NOT EXISTS position integer
    CHECK (position IS NULL OR position > 0);

COMMENT ON COLUMN public.teacher_report_card_comments.position IS
  'Class rank for this subject (1 = highest term average). Snapshot at the time the report card was generated; preview falls back to this when live ranking is unavailable.';
