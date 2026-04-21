-- Extended school profile, academic calendar, and branding for admin settings.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS registration_number TEXT,
  ADD COLUMN IF NOT EXISTS motto TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#4f46e5';

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS current_academic_year TEXT,
  ADD COLUMN IF NOT EXISTS term_structure TEXT DEFAULT '2_terms',
  ADD COLUMN IF NOT EXISTS term_1_start DATE,
  ADD COLUMN IF NOT EXISTS term_1_end DATE,
  ADD COLUMN IF NOT EXISTS term_2_start DATE,
  ADD COLUMN IF NOT EXISTS term_2_end DATE,
  ADD COLUMN IF NOT EXISTS term_3_start DATE,
  ADD COLUMN IF NOT EXISTS term_3_end DATE;

UPDATE public.schools
SET term_structure = '2_terms'
WHERE term_structure IS NULL;

ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_term_structure_check;
ALTER TABLE public.schools
  ADD CONSTRAINT schools_term_structure_check
  CHECK (term_structure IS NULL OR term_structure IN ('2_terms', '3_terms'));

COMMENT ON COLUMN public.schools.current_academic_year IS 'Display label e.g. 2025/2026';
COMMENT ON COLUMN public.schools.term_structure IS '2_terms or 3_terms — term_3_* used when 3_terms';
COMMENT ON COLUMN public.schools.primary_color IS 'Hex accent for school UI, default indigo-600';
