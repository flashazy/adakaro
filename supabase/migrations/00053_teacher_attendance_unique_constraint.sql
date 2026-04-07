-- Attendance rows live in public.teacher_attendance (not "attendance").
-- Natural key: one record per student per class per calendar day.
-- Column for the day is attendance_date (date), not "date".
-- 00047_teacher_role_and_tables.sql already defines:
--   UNIQUE (student_id, attendance_date, class_id)
-- This migration adds the same rule under an explicit name if missing (e.g. legacy DBs).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'teacher_attendance'
      AND c.conname = 'teacher_attendance_student_id_attendance_date_class_id_key'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'teacher_attendance'
      AND c.conname = 'teacher_attendance_class_student_attendance_date_key'
  ) THEN
    ALTER TABLE public.teacher_attendance
      ADD CONSTRAINT teacher_attendance_class_student_attendance_date_key
      UNIQUE (class_id, student_id, attendance_date);
  END IF;
END $$;
