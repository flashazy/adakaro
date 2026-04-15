-- Remote / legacy DBs may define teacher_attendance_unique_record on
-- (teacher_id, class_id, student_id, attendance_date) with NO subject scope.
-- That blocks a second row for the same student on the same day (e.g. Geography
-- after another subject), causing 23505 and empty subject-filtered history.

ALTER TABLE public.teacher_attendance
  DROP CONSTRAINT IF EXISTS teacher_attendance_unique_record;

DROP INDEX IF EXISTS public.teacher_attendance_unique_record;

-- Replace 4-column scope index from 00075 with one that includes teacher_id
-- so PostgREST upsert can target a single unambiguous unique index.
DROP INDEX IF EXISTS public.teacher_attendance_scope_unique;
CREATE UNIQUE INDEX teacher_attendance_scope_unique
  ON public.teacher_attendance (
    teacher_id,
    class_id,
    student_id,
    attendance_date,
    attendance_scope_key
  );
