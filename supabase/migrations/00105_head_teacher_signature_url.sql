-- Head teacher signature for report cards (PNG/JPEG/WebP in school-assets bucket).
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS head_teacher_signature_url text;

COMMENT ON COLUMN public.schools.head_teacher_signature_url IS
  'Public URL for the head teacher written signature (school-assets, path schools/{id}/head-teacher-signature.{ext}).';

-- RLS: paths schools/{school_id}/head-teacher-signature.* — allow school admin, any teacher
-- assigned to the school, or super admin. Reuses public bucket read policy.
CREATE POLICY "school_assets_insert_head_sig_eligible"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND split_part(name, '/', 2) <> ''
    AND split_part(name, '/', 3) ~* '^head-teacher-signature\\.(png|jpg|jpeg|webp)$'
    AND (
      public.is_school_admin((split_part(name, '/', 2))::uuid)
      OR public.is_teacher_for_school((split_part(name, '/', 2))::uuid)
      OR public.is_super_admin()
    )
  );

CREATE POLICY "school_assets_update_head_sig_eligible"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND split_part(name, '/', 3) ~* '^head-teacher-signature\\.(png|jpg|jpeg|webp)$'
    AND (
      public.is_school_admin((split_part(name, '/', 2))::uuid)
      OR public.is_teacher_for_school((split_part(name, '/', 2))::uuid)
      OR public.is_super_admin()
    )
  )
  WITH CHECK (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND split_part(name, '/', 3) ~* '^head-teacher-signature\\.(png|jpg|jpeg|webp)$'
    AND (
      public.is_school_admin((split_part(name, '/', 2))::uuid)
      OR public.is_teacher_for_school((split_part(name, '/', 2))::uuid)
      OR public.is_super_admin()
    )
  );

CREATE POLICY "school_assets_delete_head_sig_eligible"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND split_part(name, '/', 3) ~* '^head-teacher-signature\\.(png|jpg|jpeg|webp)$'
    AND (
      public.is_school_admin((split_part(name, '/', 2))::uuid)
      OR public.is_teacher_for_school((split_part(name, '/', 2))::uuid)
      OR public.is_super_admin()
    )
  );
