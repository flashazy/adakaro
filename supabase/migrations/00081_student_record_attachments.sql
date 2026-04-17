-- Student discipline/health record file attachments (private storage + RLS).
-- Scopes: school admins full CRUD; teachers upload + view; dept staff view one domain only.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_teacher_for_student_by_id(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = p_student_id
      AND public.is_teacher_for_class(s.class_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_for_student_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_for_student_by_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_record_attachment_scope(p_school_id uuid, p_scope text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_member_record_attachment_scopes sc
    WHERE sc.school_id = p_school_id
      AND sc.user_id = auth.uid()
      AND sc.scope = p_scope
  );
$$;

REVOKE ALL ON FUNCTION public.has_record_attachment_scope(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_record_attachment_scope(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- school_member_record_attachment_scopes (admin-managed)
-- ---------------------------------------------------------------------------
CREATE TABLE public.school_member_record_attachment_scopes (
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('health', 'discipline')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, user_id, scope)
);

CREATE INDEX idx_record_attachment_scopes_user
  ON public.school_member_record_attachment_scopes (user_id);

ALTER TABLE public.school_member_record_attachment_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "record_attachment_scopes_select"
  ON public.school_member_record_attachment_scopes FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

CREATE POLICY "record_attachment_scopes_write_admin"
  ON public.school_member_record_attachment_scopes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY "record_attachment_scopes_update_admin"
  ON public.school_member_record_attachment_scopes FOR UPDATE
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY "record_attachment_scopes_delete_admin"
  ON public.school_member_record_attachment_scopes FOR DELETE
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

-- ---------------------------------------------------------------------------
-- student_record_attachments
-- ---------------------------------------------------------------------------
CREATE TABLE public.student_record_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('discipline', 'health')),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  description text,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_record_attachments_record
  ON public.student_record_attachments (record_id, record_type);

CREATE TRIGGER student_record_attachments_updated_at
  BEFORE UPDATE ON public.student_record_attachments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.student_record_attachments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_student_record_attachment_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.record_type = 'discipline' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.student_discipline_records dr WHERE dr.id = NEW.record_id
    ) THEN
      RAISE EXCEPTION 'student_record_attachments: invalid discipline record_id';
    END IF;
  ELSIF NEW.record_type = 'health' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.student_health_records hr WHERE hr.id = NEW.record_id
    ) THEN
      RAISE EXCEPTION 'student_record_attachments: invalid health record_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_student_record_attachment_row() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_student_record_attachment_row() TO authenticated;

CREATE TRIGGER student_record_attachments_validate
  BEFORE INSERT OR UPDATE ON public.student_record_attachments
  FOR EACH ROW EXECUTE FUNCTION public.validate_student_record_attachment_row();

CREATE POLICY "student_record_attachments_select"
  ON public.student_record_attachments FOR SELECT
  TO authenticated
  USING (
    (
      record_type = 'discipline'
      AND EXISTS (
        SELECT 1
        FROM public.student_discipline_records dr
        JOIN public.students s ON s.id = dr.student_id
        WHERE dr.id = student_record_attachments.record_id
          AND (
            public.is_school_admin(s.school_id)
            OR public.is_super_admin()
            OR public.is_teacher_for_class(s.class_id)
            OR public.has_record_attachment_scope(s.school_id, 'discipline')
          )
      )
    )
    OR (
      record_type = 'health'
      AND EXISTS (
        SELECT 1
        FROM public.student_health_records hr
        JOIN public.students s ON s.id = hr.student_id
        WHERE hr.id = student_record_attachments.record_id
          AND (
            public.is_school_admin(s.school_id)
            OR public.is_super_admin()
            OR public.is_teacher_for_class(s.class_id)
            OR public.has_record_attachment_scope(s.school_id, 'health')
          )
      )
    )
  );

CREATE POLICY "student_record_attachments_insert"
  ON public.student_record_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      record_type = 'discipline'
      AND EXISTS (
        SELECT 1
        FROM public.student_discipline_records dr
        JOIN public.students s ON s.id = dr.student_id
        WHERE dr.id = student_record_attachments.record_id
          AND (
            public.is_school_admin(s.school_id)
            OR public.is_super_admin()
            OR public.is_teacher_for_class(s.class_id)
          )
      )
    )
    OR (
      record_type = 'health'
      AND EXISTS (
        SELECT 1
        FROM public.student_health_records hr
        JOIN public.students s ON s.id = hr.student_id
        WHERE hr.id = student_record_attachments.record_id
          AND (
            public.is_school_admin(s.school_id)
            OR public.is_super_admin()
            OR public.is_teacher_for_class(s.class_id)
          )
      )
    )
  );

CREATE POLICY "student_record_attachments_delete_admin"
  ON public.student_record_attachments FOR DELETE
  TO authenticated
  USING (
    (
      record_type = 'discipline'
      AND EXISTS (
        SELECT 1
        FROM public.student_discipline_records dr
        JOIN public.students s ON s.id = dr.student_id
        WHERE dr.id = student_record_attachments.record_id
          AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
      )
    )
    OR (
      record_type = 'health'
      AND EXISTS (
        SELECT 1
        FROM public.student_health_records hr
        JOIN public.students s ON s.id = hr.student_id
        WHERE hr.id = student_record_attachments.record_id
          AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Allow dept-scoped staff to read underlying health/discipline rows (same school)
-- ---------------------------------------------------------------------------
CREATE POLICY "student_health_records_select_attachment_scope"
  ON public.student_health_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_health_records.student_id
        AND public.has_record_attachment_scope(s.school_id, 'health')
    )
  );

CREATE POLICY "student_discipline_records_select_attachment_scope"
  ON public.student_discipline_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_discipline_records.student_id
        AND public.has_record_attachment_scope(s.school_id, 'discipline')
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: student-record-attachments (private)
-- Path layout: {school_id}/{student_id}/{record_type}/{random_stem}_{original_name}
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-record-attachments',
  'student-record-attachments',
  false,
  5242880,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "student_record_attachments_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "student_record_attachments_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "student_record_attachments_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "student_record_attachments_storage_delete" ON storage.objects;

CREATE POLICY "student_record_attachments_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student-record-attachments'
    AND (
      public.is_super_admin()
      OR public.is_school_admin(split_part(name, '/', 1)::uuid)
      OR public.is_teacher_for_student_by_id(split_part(name, '/', 2)::uuid)
      OR (
        split_part(name, '/', 3) = 'health'
        AND public.has_record_attachment_scope(split_part(name, '/', 1)::uuid, 'health')
      )
      OR (
        split_part(name, '/', 3) = 'discipline'
        AND public.has_record_attachment_scope(split_part(name, '/', 1)::uuid, 'discipline')
      )
    )
  );

CREATE POLICY "student_record_attachments_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-record-attachments'
    AND (
      public.is_super_admin()
      OR public.is_school_admin(split_part(name, '/', 1)::uuid)
      OR public.is_teacher_for_student_by_id(split_part(name, '/', 2)::uuid)
    )
  );

CREATE POLICY "student_record_attachments_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'student-record-attachments'
    AND (
      public.is_super_admin()
      OR public.is_school_admin(split_part(name, '/', 1)::uuid)
      OR public.is_teacher_for_student_by_id(split_part(name, '/', 2)::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'student-record-attachments'
    AND (
      public.is_super_admin()
      OR public.is_school_admin(split_part(name, '/', 1)::uuid)
      OR public.is_teacher_for_student_by_id(split_part(name, '/', 2)::uuid)
    )
  );

CREATE POLICY "student_record_attachments_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-record-attachments'
    AND (
      public.is_super_admin()
      OR public.is_school_admin(split_part(name, '/', 1)::uuid)
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_member_record_attachment_scopes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.student_record_attachments TO authenticated;

GRANT ALL ON public.school_member_record_attachment_scopes TO service_role;
GRANT ALL ON public.student_record_attachments TO service_role;
