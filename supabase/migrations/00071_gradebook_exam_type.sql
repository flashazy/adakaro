-- Major exam types + academic year for duplicate prevention (class + subject + year + exam_type).

ALTER TABLE public.teacher_gradebook_assignments
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS exam_type text;

-- Backfill academic_year from the teacher's assignment row for the same class + subject.
UPDATE public.teacher_gradebook_assignments g
SET academic_year = sub.ay
FROM (
  SELECT DISTINCT ON (g2.id)
    g2.id,
    COALESCE(
      NULLIF(trim(ta.academic_year), ''),
      to_char(timezone('UTC', now()), 'YYYY')
    ) AS ay
  FROM public.teacher_gradebook_assignments g2
  LEFT JOIN public.teacher_assignments ta
    ON ta.teacher_id = g2.teacher_id
    AND ta.class_id = g2.class_id
    AND (
      lower(trim(both from coalesce(ta.subject, ''))) = lower(trim(both from g2.subject))
      OR EXISTS (
        SELECT 1
        FROM public.subjects s
        WHERE ta.subject_id IS NOT NULL
          AND s.id = ta.subject_id
          AND lower(trim(both from coalesce(s.name, ''))) = lower(trim(both from g2.subject))
      )
    )
  ORDER BY g2.id, ta.created_at DESC NULLS LAST
) sub
WHERE g.id = sub.id
  AND (g.academic_year IS NULL OR trim(g.academic_year) = '');

UPDATE public.teacher_gradebook_assignments
SET academic_year = to_char(timezone('UTC', now()), 'YYYY')
WHERE academic_year IS NULL OR trim(academic_year) = '';

ALTER TABLE public.teacher_gradebook_assignments
  ALTER COLUMN academic_year SET NOT NULL,
  ALTER COLUMN academic_year SET DEFAULT to_char(timezone('UTC', now()), 'YYYY');

ALTER TABLE public.teacher_gradebook_assignments
  ADD CONSTRAINT teacher_gradebook_assignments_exam_type_check
  CHECK (
    exam_type IS NULL
    OR exam_type IN (
      'April_Midterm',
      'June_Terminal',
      'September_Midterm',
      'December_Annual'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_gradebook_major_exam_unique
  ON public.teacher_gradebook_assignments (
    class_id,
    lower(trim(both from subject)),
    academic_year,
    exam_type
  )
  WHERE exam_type IS NOT NULL;
