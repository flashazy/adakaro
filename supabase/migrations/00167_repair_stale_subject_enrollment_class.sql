-- Repair student_subject_enrollment rows whose class_id no longer matches the
-- student's current class after streaming / promotion / admin class edits.
-- Only moves enrollment when the subject is offered on the student's current
-- class (subject_classes). Idempotent.

UPDATE public.student_subject_enrollment
SET
  class_id = s.class_id,
  updated_at = now()
FROM public.students AS s
WHERE student_subject_enrollment.student_id = s.id
  AND s.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.subject_classes AS sc
    WHERE sc.class_id = s.class_id
      AND sc.subject_id = student_subject_enrollment.subject_id
  )
  AND student_subject_enrollment.class_id IS DISTINCT FROM s.class_id;
