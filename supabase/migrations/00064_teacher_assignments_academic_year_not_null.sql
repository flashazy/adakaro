-- Single calendar year (e.g. 2025), required for professional tracking.

UPDATE public.teacher_assignments
SET academic_year = to_char(current_date, 'YYYY')
WHERE academic_year IS NULL OR trim(academic_year) = '';

ALTER TABLE public.teacher_assignments
  ALTER COLUMN academic_year SET NOT NULL;
