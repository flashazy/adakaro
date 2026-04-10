-- Correct enrollment_date for students who were given CURRENT_DATE at column add time,
-- or where attendance exists before the stored enrollment_date.
-- Anyone without attendance rows gets 2024-01-01 so past sessions can list them.
UPDATE public.students s
SET enrollment_date = COALESCE(
  (
    SELECT MIN(ta.attendance_date)::date
    FROM public.teacher_attendance ta
    WHERE ta.student_id = s.id
  ),
  '2024-01-01'::date
)
WHERE s.enrollment_date IS NULL
  OR s.enrollment_date > CURRENT_DATE
  OR EXISTS (
    SELECT 1
    FROM public.teacher_attendance ta2
    WHERE ta2.student_id = s.id
      AND ta2.attendance_date < s.enrollment_date
  );
