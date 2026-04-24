-- Official school stamp image URL (public storage) — report cards, receipts, etc.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS school_stamp_url text;

COMMENT ON COLUMN public.schools.school_stamp_url IS
  'Public URL for the school official stamp (PNG/JPEG/WebP in school-assets bucket).';

-- Bucket: paths schools/{school_id}/stamp.{ext} — RLS enforces school admin for write.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'school-assets',
  'school-assets',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "school_assets_select_public" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_insert_school_admin" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_update_school_admin" ON storage.objects;
DROP POLICY IF EXISTS "school_assets_delete_school_admin" ON storage.objects;

CREATE POLICY "school_assets_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'school-assets');

CREATE POLICY "school_assets_insert_school_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND split_part(name, '/', 2) <> ''
    AND EXISTS (
      SELECT 1
      FROM public.school_members sm
      WHERE sm.user_id = auth.uid()
        AND sm.school_id::text = split_part(name, '/', 2)
        AND sm.role = 'admin'::public.user_role
    )
  );

CREATE POLICY "school_assets_update_school_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND EXISTS (
      SELECT 1
      FROM public.school_members sm
      WHERE sm.user_id = auth.uid()
        AND sm.school_id::text = split_part(name, '/', 2)
        AND sm.role = 'admin'::public.user_role
    )
  )
  WITH CHECK (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND EXISTS (
      SELECT 1
      FROM public.school_members sm
      WHERE sm.user_id = auth.uid()
        AND sm.school_id::text = split_part(name, '/', 2)
        AND sm.role = 'admin'::public.user_role
    )
  );

CREATE POLICY "school_assets_delete_school_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'school-assets'
    AND split_part(name, '/', 1) = 'schools'
    AND EXISTS (
      SELECT 1
      FROM public.school_members sm
      WHERE sm.user_id = auth.uid()
        AND sm.school_id::text = split_part(name, '/', 2)
        AND sm.role = 'admin'::public.user_role
    )
  );
