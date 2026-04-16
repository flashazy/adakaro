-- Student passport-style photo: DB column + public storage bucket + RLS on storage.objects.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.students.avatar_url IS
  'Public URL for student-avatars bucket object (path {student_id}/avatar.webp|jpg|png).';

-- Public bucket: anyone can read URLs; uploads scoped to admins/teachers for that student.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-avatars',
  'student-avatars',
  true,
  2097152,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "student_avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "student_avatars_insert_scoped" ON storage.objects;
DROP POLICY IF EXISTS "student_avatars_update_scoped" ON storage.objects;
DROP POLICY IF EXISTS "student_avatars_delete_scoped" ON storage.objects;

CREATE POLICY "student_avatars_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'student-avatars');

CREATE POLICY "student_avatars_insert_scoped"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-avatars'
    AND split_part(name, '/', 2) IN ('avatar.webp', 'avatar.jpg', 'avatar.png')
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id::text = split_part(name, '/', 1)
        AND (
          public.is_school_admin(s.school_id)
          OR public.is_teacher_for_class(s.class_id)
          OR public.is_super_admin()
        )
    )
  );

CREATE POLICY "student_avatars_update_scoped"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'student-avatars'
    AND split_part(name, '/', 2) IN ('avatar.webp', 'avatar.jpg', 'avatar.png')
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id::text = split_part(name, '/', 1)
        AND (
          public.is_school_admin(s.school_id)
          OR public.is_teacher_for_class(s.class_id)
          OR public.is_super_admin()
        )
    )
  )
  WITH CHECK (
    bucket_id = 'student-avatars'
    AND split_part(name, '/', 2) IN ('avatar.webp', 'avatar.jpg', 'avatar.png')
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id::text = split_part(name, '/', 1)
        AND (
          public.is_school_admin(s.school_id)
          OR public.is_teacher_for_class(s.class_id)
          OR public.is_super_admin()
        )
    )
  );

CREATE POLICY "student_avatars_delete_scoped"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-avatars'
    AND split_part(name, '/', 2) IN ('avatar.webp', 'avatar.jpg', 'avatar.png')
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id::text = split_part(name, '/', 1)
        AND (
          public.is_school_admin(s.school_id)
          OR public.is_teacher_for_class(s.class_id)
          OR public.is_super_admin()
        )
    )
  );
