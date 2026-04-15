-- Phase 1: subject-based student enrollment (Tanzanian secondary).
-- Stores which subjects a student takes per class, academic year, and term.

CREATE TABLE public.student_subject_enrollment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year integer NOT NULL DEFAULT (EXTRACT(YEAR FROM CURRENT_DATE))::integer,
  term text NOT NULL CHECK (term IN ('Term 1', 'Term 2')),
  enrolled_from date NOT NULL DEFAULT CURRENT_DATE,
  enrolled_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, academic_year, term)
);

CREATE INDEX idx_student_subject_student ON public.student_subject_enrollment (student_id);
CREATE INDEX idx_student_subject_subject ON public.student_subject_enrollment (subject_id);
CREATE INDEX idx_student_subject_class ON public.student_subject_enrollment (class_id);
CREATE INDEX idx_student_subject_year_term ON public.student_subject_enrollment (academic_year, term);

CREATE TRIGGER student_subject_enrollment_updated_at
  BEFORE UPDATE ON public.student_subject_enrollment
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Ensure class matches student and subject is linked to class / school.
CREATE OR REPLACE FUNCTION public.validate_student_subject_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT st.school_id INTO v_school_id
  FROM public.students st
  WHERE st.id = NEW.student_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.students st
    WHERE st.id = NEW.student_id AND st.class_id = NEW.class_id
  ) THEN
    RAISE EXCEPTION 'class_id must match the student''s current class';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subject_classes sc
    INNER JOIN public.subjects su ON su.id = sc.subject_id
    WHERE sc.subject_id = NEW.subject_id
      AND sc.class_id = NEW.class_id
      AND su.school_id = v_school_id
  ) THEN
    RAISE EXCEPTION 'Subject is not offered for this class';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_student_subject_enrollment_validate
  BEFORE INSERT OR UPDATE ON public.student_subject_enrollment
  FOR EACH ROW EXECUTE FUNCTION public.validate_student_subject_enrollment();

ALTER TABLE public.student_subject_enrollment ENABLE ROW LEVEL SECURITY;

-- Teachers: read enrollments for classes they are assigned to.
CREATE POLICY "student_subject_enrollment_select_teacher"
  ON public.student_subject_enrollment FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      WHERE ta.teacher_id = auth.uid()
        AND ta.class_id = student_subject_enrollment.class_id
    )
  );

-- School admins: full read for their school’s students.
CREATE POLICY "student_subject_enrollment_select_admin"
  ON public.student_subject_enrollment FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = student_subject_enrollment.student_id
        AND public.is_school_admin(st.school_id)
    )
  );

CREATE POLICY "student_subject_enrollment_select_super_admin"
  ON public.student_subject_enrollment FOR SELECT
  USING (public.is_super_admin());

-- Writes: school admins and super admins only (dashboard student management).
CREATE POLICY "student_subject_enrollment_insert_admin"
  ON public.student_subject_enrollment FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = student_id
        AND st.class_id = class_id
        AND public.is_school_admin(st.school_id)
    )
    OR public.is_super_admin()
  );

CREATE POLICY "student_subject_enrollment_update_admin"
  ON public.student_subject_enrollment FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = student_subject_enrollment.student_id
        AND public.is_school_admin(st.school_id)
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = student_id
        AND st.class_id = class_id
        AND (public.is_school_admin(st.school_id) OR public.is_super_admin())
    )
  );

CREATE POLICY "student_subject_enrollment_delete_admin"
  ON public.student_subject_enrollment FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = student_subject_enrollment.student_id
        AND public.is_school_admin(st.school_id)
    )
    OR public.is_super_admin()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_subject_enrollment TO authenticated;
GRANT ALL ON TABLE public.student_subject_enrollment TO service_role;
