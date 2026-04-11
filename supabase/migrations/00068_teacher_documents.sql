-- Teacher personal documents (private storage + RLS)

CREATE TABLE IF NOT EXISTS public.teacher_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  category TEXT NOT NULL DEFAULT 'Other',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_documents_teacher_id_idx
  ON public.teacher_documents (teacher_id);

CREATE INDEX IF NOT EXISTS teacher_documents_uploaded_at_idx
  ON public.teacher_documents (teacher_id, uploaded_at DESC);

DROP TRIGGER IF EXISTS teacher_documents_updated_at ON public.teacher_documents;
CREATE TRIGGER teacher_documents_updated_at
  BEFORE UPDATE ON public.teacher_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.teacher_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view their own documents" ON public.teacher_documents;
DROP POLICY IF EXISTS "Teachers can insert their own documents" ON public.teacher_documents;
DROP POLICY IF EXISTS "Teachers can update their own documents" ON public.teacher_documents;
DROP POLICY IF EXISTS "Teachers can delete their own documents" ON public.teacher_documents;

CREATE POLICY "Teachers can view their own documents"
  ON public.teacher_documents FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert their own documents"
  ON public.teacher_documents FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own documents"
  ON public.teacher_documents FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own documents"
  ON public.teacher_documents FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('teacher-docs', 'teacher-docs', false, 10485760, NULL)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 10485760;

DROP POLICY IF EXISTS "teacher_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "teacher_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "teacher_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "teacher_docs_delete_own" ON storage.objects;

CREATE POLICY "teacher_docs_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'teacher-docs'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "teacher_docs_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'teacher-docs'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "teacher_docs_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'teacher-docs'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'teacher-docs'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "teacher_docs_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'teacher-docs'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
