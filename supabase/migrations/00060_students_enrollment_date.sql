-- Enrollment date: attendance only lists students with enrollment_date <= session date.
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE;

COMMENT ON COLUMN public.students.enrollment_date IS 'Date the student enrolled; attendance uses enrollment_date <= selected date.';
