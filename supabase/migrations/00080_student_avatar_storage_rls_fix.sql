-- Fix student-avatars storage uploads failing with RLS.
-- storage.objects policies that use `EXISTS (SELECT … FROM students …)` run that
-- subquery with the invoker role, so students RLS can hide the row and deny the upload.
-- This helper runs with row_security = off and only delegates permission to is_school_admin /
-- is_teacher_for_class / is_super_admin (those already use SECURITY DEFINER as needed).

CREATE OR REPLACE FUNCTION public.can_manage_student_avatar_storage(
  p_bucket_id text,
  p_name text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  student_id uuid;
BEGIN
  IF p_bucket_id IS DISTINCT FROM 'student-avatars' THEN
    RETURN FALSE;
  END IF;
  IF split_part(p_name, '/', 2) NOT IN ('avatar.webp', 'avatar.jpg', 'avatar.png') THEN
    RETURN FALSE;
  END IF;
  BEGIN
    student_id := (split_part(p_name, '/', 1))::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN FALSE;
  END;
  RETURN EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = student_id
      AND (
        public.is_school_admin(s.school_id)
        OR public.is_teacher_for_class(s.class_id)
        OR public.is_super_admin()
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_student_avatar_storage(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_student_avatar_storage(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_student_avatar_storage(text, text) TO service_role;

COMMENT ON FUNCTION public.can_manage_student_avatar_storage(text, text) IS
  'True if the object path is a student avatar and the current user may manage it. Used by storage.objects RLS.';

DROP POLICY IF EXISTS "student_avatars_insert_scoped" ON storage.objects;
DROP POLICY IF EXISTS "student_avatars_update_scoped" ON storage.objects;
DROP POLICY IF EXISTS "student_avatars_delete_scoped" ON storage.objects;

CREATE POLICY "student_avatars_insert_scoped"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_student_avatar_storage(bucket_id, name)
  );

CREATE POLICY "student_avatars_update_scoped"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (public.can_manage_student_avatar_storage(bucket_id, name))
  WITH CHECK (public.can_manage_student_avatar_storage(bucket_id, name));

CREATE POLICY "student_avatars_delete_scoped"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (public.can_manage_student_avatar_storage(bucket_id, name));
