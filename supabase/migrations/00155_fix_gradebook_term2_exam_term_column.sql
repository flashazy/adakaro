-- Correct `term` on Term 2 major exams (often stored as Term 1 when created before term backfill).
-- Filtering still infers from exam_type, but the stored column should match for reporting.

UPDATE public.teacher_gradebook_assignments
SET term = 'Term 2'
WHERE exam_type IN ('September_Midterm', 'December_Annual')
  AND (term IS DISTINCT FROM 'Term 2');

UPDATE public.teacher_gradebook_assignments
SET term = 'Term 1'
WHERE exam_type IN ('April_Midterm', 'June_Terminal')
  AND (term IS DISTINCT FROM 'Term 1');

-- Title-based fix for legacy rows without exam_type
UPDATE public.teacher_gradebook_assignments
SET term = 'Term 2'
WHERE exam_type IS NULL
  AND title IN (
    'September Midterm Examination',
    'December Annual Examination'
  )
  AND (term IS DISTINCT FROM 'Term 2');
