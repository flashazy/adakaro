-- Phase 1: Student profile records (academic, discipline, health, finance).
-- RLS: school admins and platform super admins have full CRUD.
-- Teachers may SELECT rows for students in their assigned classes (view-only at DB layer; Phase 1 UI is admin-only).
-- Future Phase 2: department-scoped roles can replace or narrow these policies.

-- ---------------------------------------------------------------------------
-- student_academic_records
-- ---------------------------------------------------------------------------
CREATE TABLE public.student_academic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year integer NOT NULL,
  term text NOT NULL CHECK (term IN ('Term 1', 'Term 2')),
  notes text,
  special_needs text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_academic_records_student_year_term_unique UNIQUE (student_id, academic_year, term)
);

CREATE INDEX idx_student_academic_records_student
  ON public.student_academic_records (student_id);

CREATE TRIGGER student_academic_records_updated_at
  BEFORE UPDATE ON public.student_academic_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.student_academic_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_academic_records_select"
  ON public.student_academic_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_academic_records.student_id
        AND (
          public.is_school_admin(s.school_id)
          OR public.is_super_admin()
          OR public.is_teacher_for_class(s.class_id)
        )
    )
  );

CREATE POLICY "student_academic_records_insert_admin"
  ON public.student_academic_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_academic_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

CREATE POLICY "student_academic_records_update_admin"
  ON public.student_academic_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_academic_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_academic_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

CREATE POLICY "student_academic_records_delete_admin"
  ON public.student_academic_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_academic_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- student_discipline_records
-- ---------------------------------------------------------------------------
CREATE TABLE public.student_discipline_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  incident_date date NOT NULL,
  incident_type text NOT NULL CHECK (
    incident_type IN ('warning', 'detention', 'suspension', 'expulsion', 'other')
  ),
  description text NOT NULL,
  action_taken text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'resolved', 'appealed')
  ),
  resolved_date date,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_discipline_records_student
  ON public.student_discipline_records (student_id);
CREATE INDEX idx_student_discipline_records_incident_date
  ON public.student_discipline_records (student_id, incident_date DESC);

CREATE TRIGGER student_discipline_records_updated_at
  BEFORE UPDATE ON public.student_discipline_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.student_discipline_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_discipline_records_select"
  ON public.student_discipline_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_discipline_records.student_id
        AND (
          public.is_school_admin(s.school_id)
          OR public.is_super_admin()
          OR public.is_teacher_for_class(s.class_id)
        )
    )
  );

CREATE POLICY "student_discipline_records_insert_admin"
  ON public.student_discipline_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_discipline_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

CREATE POLICY "student_discipline_records_update_admin"
  ON public.student_discipline_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_discipline_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_discipline_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

CREATE POLICY "student_discipline_records_delete_admin"
  ON public.student_discipline_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_discipline_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- student_health_records
-- ---------------------------------------------------------------------------
CREATE TABLE public.student_health_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  condition text NOT NULL,
  severity text CHECK (severity IN ('mild', 'moderate', 'severe')),
  medication text,
  special_care_notes text,
  emergency_contact_phone text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_health_records_student
  ON public.student_health_records (student_id);

CREATE TRIGGER student_health_records_updated_at
  BEFORE UPDATE ON public.student_health_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.student_health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_health_records_select"
  ON public.student_health_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_health_records.student_id
        AND (
          public.is_school_admin(s.school_id)
          OR public.is_super_admin()
          OR public.is_teacher_for_class(s.class_id)
        )
    )
  );

CREATE POLICY "student_health_records_insert_admin"
  ON public.student_health_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_health_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

CREATE POLICY "student_health_records_update_admin"
  ON public.student_health_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_health_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_health_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

CREATE POLICY "student_health_records_delete_admin"
  ON public.student_health_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_health_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- student_finance_records
-- ---------------------------------------------------------------------------
CREATE TABLE public.student_finance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year integer NOT NULL,
  term text NOT NULL CHECK (term IN ('Term 1', 'Term 2')),
  fee_balance numeric(10, 2) NOT NULL DEFAULT 0,
  scholarship_amount numeric(10, 2) NOT NULL DEFAULT 0,
  scholarship_type text,
  payment_notes text,
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_finance_records_student_year_term_unique UNIQUE (student_id, academic_year, term)
);

CREATE INDEX idx_student_finance_records_student
  ON public.student_finance_records (student_id);

CREATE TRIGGER student_finance_records_updated_at
  BEFORE UPDATE ON public.student_finance_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.student_finance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_finance_records_select"
  ON public.student_finance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_finance_records.student_id
        AND (
          public.is_school_admin(s.school_id)
          OR public.is_super_admin()
          OR public.is_teacher_for_class(s.class_id)
        )
    )
  );

CREATE POLICY "student_finance_records_insert_admin"
  ON public.student_finance_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_finance_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

CREATE POLICY "student_finance_records_update_admin"
  ON public.student_finance_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_finance_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_finance_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

CREATE POLICY "student_finance_records_delete_admin"
  ON public.student_finance_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_finance_records.student_id
        AND (public.is_school_admin(s.school_id) OR public.is_super_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_academic_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_discipline_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_health_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_finance_records TO authenticated;

GRANT ALL ON public.student_academic_records TO service_role;
GRANT ALL ON public.student_discipline_records TO service_role;
GRANT ALL ON public.student_health_records TO service_role;
GRANT ALL ON public.student_finance_records TO service_role;
