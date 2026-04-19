-- Tanzania has two school tiers with different report-card maths:
--   * primary   → every subject counts equally; rank by overall average %
--   * secondary → only the best 7 subject averages count; rank by total marks
-- Default to 'primary' so existing rows stay compatible.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS school_level text
    NOT NULL DEFAULT 'primary'
    CHECK (school_level IN ('primary', 'secondary'));
