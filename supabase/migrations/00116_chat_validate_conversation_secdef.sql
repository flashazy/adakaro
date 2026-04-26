-- Teachers inserting chat_conversations hit BEFORE INSERT trigger validate_chat_conversation_row,
-- which reads parent_students. Teachers have no SELECT policy on parent_students, so the
-- trigger failed with "permission denied" (often surfaced on chat_conversations).
-- Run validation as SECURITY DEFINER like other chat helpers.

CREATE OR REPLACE FUNCTION public.validate_chat_conversation_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.classes cl
    WHERE cl.id = NEW.class_id
      AND cl.class_teacher_id = NEW.class_teacher_id
  ) THEN
    RAISE EXCEPTION 'class_teacher_id must match classes.class_teacher_id for class_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.students s
    INNER JOIN public.parent_students ps
      ON ps.student_id = s.id AND ps.parent_id = NEW.parent_id
    WHERE s.class_id = NEW.class_id
      AND coalesce(s.status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'parent must be linked to an active student in this class';
  END IF;

  RETURN NEW;
END;
$$;
