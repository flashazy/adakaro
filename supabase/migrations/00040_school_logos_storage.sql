-- Public bucket for school logos; paths are {user_id}/logo.{ext} (see /api/schools/create).
-- Fixes: StorageApiError "new row violates row-level security policy" on upload.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('school-logos', 'school-logos', true, 2097152, NULL)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 2097152;

-- RLS on storage.objects is enabled by default; define policies for this bucket.

DROP POLICY IF EXISTS "school_logos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "school_logos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "school_logos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "school_logos_delete_own" ON storage.objects;

-- Anyone can read objects in the public bucket (required for getPublicUrl).
CREATE POLICY "school_logos_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'school-logos');

-- Authenticated users may only create files under their own folder (first path segment = auth.uid()).
CREATE POLICY "school_logos_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'school-logos'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Upsert / replace logo in the same path.
CREATE POLICY "school_logos_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'school-logos'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'school-logos'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Optional: remove own files (e.g. change format).
CREATE POLICY "school_logos_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'school-logos'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
