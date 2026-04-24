-- Class coordinator written signature (per teacher profile, school-assets storage).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coordinator_signature_url text;

COMMENT ON COLUMN public.profiles.coordinator_signature_url IS
  'Public URL for this teacher''s coordinator signature on report cards (school-assets, path schools/{school_id}/coordinator-signatures/{user_id}.{ext}).';

-- Paths: schools/{school_id}/coordinator-signatures/{user_id}.{png|jpg|jpeg|webp}
-- Coordinators may write only files named with their own auth uid; school admins may delete any in their school.

CREATE POLICY "school_assets_insert_coordinator_sig_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND split_part(name, '/', 2) <> ''
    AND split_part(name, '/', 3) = 'coordinator-signatures'
    AND split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
    AND (split_part(split_part(name, '/', 4), '.', 1))::uuid = auth.uid()
    AND public.is_teacher_for_school((split_part(name, '/', 2))::uuid)
  );

CREATE POLICY "school_assets_update_coordinator_sig_own_or_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND split_part(name, '/', 3) = 'coordinator-signatures'
    AND split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
    AND (
      (split_part(split_part(name, '/', 4), '.', 1))::uuid = auth.uid()
      AND public.is_teacher_for_school((split_part(name, '/', 2))::uuid)
      OR public.is_school_admin((split_part(name, '/', 2))::uuid)
      OR public.is_super_admin()
    )
  )
  WITH CHECK (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND split_part(name, '/', 3) = 'coordinator-signatures'
    AND split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
    AND (
      (split_part(split_part(name, '/', 4), '.', 1))::uuid = auth.uid()
      AND public.is_teacher_for_school((split_part(name, '/', 2))::uuid)
      OR public.is_school_admin((split_part(name, '/', 2))::uuid)
      OR public.is_super_admin()
    )
  );

CREATE POLICY "school_assets_delete_coordinator_sig_own_or_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND split_part(name, '/', 3) = 'coordinator-signatures'
    AND split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'
    AND (
      (split_part(split_part(name, '/', 4), '.', 1))::uuid = auth.uid()
      AND public.is_teacher_for_school((split_part(name, '/', 2))::uuid)
      OR public.is_school_admin((split_part(name, '/', 2))::uuid)
      OR public.is_super_admin()
    )
  );
