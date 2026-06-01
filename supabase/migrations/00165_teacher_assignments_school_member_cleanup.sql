-- Remove class/subject assignments when a teacher leaves a school (any delete path).

CREATE OR REPLACE FUNCTION public.cleanup_teacher_assignments_on_member_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.role = 'teacher' THEN
    DELETE FROM public.teacher_assignments
    WHERE school_id = OLD.school_id
      AND teacher_id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS school_members_cleanup_teacher_assignments
  ON public.school_members;

CREATE TRIGGER school_members_cleanup_teacher_assignments
  AFTER DELETE ON public.school_members
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_teacher_assignments_on_member_delete();

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_school_teacher
  ON public.teacher_assignments (school_id, teacher_id);
