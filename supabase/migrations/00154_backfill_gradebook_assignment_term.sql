-- Backfill `term` on gradebook assignments where it is missing or wrong.
-- Major exams: derive from exam_type; custom rows: infer from title when possible.

UPDATE public.teacher_gradebook_assignments
SET term = 'Term 1'
WHERE (term IS NULL OR trim(term) = '' OR term NOT IN ('Term 1', 'Term 2'))
  AND exam_type IN ('April_Midterm', 'June_Terminal');

UPDATE public.teacher_gradebook_assignments
SET term = 'Term 2'
WHERE (term IS NULL OR trim(term) = '' OR term NOT IN ('Term 1', 'Term 2'))
  AND exam_type IN ('September_Midterm', 'December_Annual');

UPDATE public.teacher_gradebook_assignments
SET term = 'Term 2'
WHERE (term IS NULL OR trim(term) = '')
  AND exam_type IS NULL
  AND (
    lower(title) LIKE '%september%'
    OR lower(title) LIKE '%october%'
    OR lower(title) LIKE '%november%'
    OR lower(title) LIKE '%december%'
  );

UPDATE public.teacher_gradebook_assignments
SET term = 'Term 1'
WHERE (term IS NULL OR trim(term) = '')
  AND exam_type IS NULL
  AND (
    lower(title) LIKE '%april%'
    OR lower(title) LIKE '%may%'
    OR lower(title) LIKE '%june%'
  );
