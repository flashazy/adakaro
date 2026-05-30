-- Student Streaming & Placement — coordinator workflow for assigning students
-- into stream classes based on examination performance. Separate from promotions.

-- ---------------------------------------------------------------------------
-- streaming_placement_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.streaming_placement_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  parent_class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  exam_type text NOT NULL,
  performance_measure text NOT NULL
    CHECK (performance_measure IN ('average_score', 'division', 'total_marks')),
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, parent_class_id, academic_year, exam_type, performance_measure)
);

CREATE INDEX IF NOT EXISTS idx_streaming_placement_rules_school
  ON public.streaming_placement_rules (school_id);

CREATE INDEX IF NOT EXISTS idx_streaming_placement_rules_parent
  ON public.streaming_placement_rules (parent_class_id);

DROP TRIGGER IF EXISTS streaming_placement_rules_updated_at
  ON public.streaming_placement_rules;
CREATE TRIGGER streaming_placement_rules_updated_at
  BEFORE UPDATE ON public.streaming_placement_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.streaming_placement_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "streaming_placement_rules_select"
  ON public.streaming_placement_rules;
CREATE POLICY "streaming_placement_rules_select"
  ON public.streaming_placement_rules FOR SELECT
  TO authenticated
  USING (
    public.is_school_admin(school_id)
    OR public.is_super_admin()
    OR public.is_class_coordinator(parent_class_id)
  );

DROP POLICY IF EXISTS "streaming_placement_rules_insert"
  ON public.streaming_placement_rules;
CREATE POLICY "streaming_placement_rules_insert"
  ON public.streaming_placement_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_class_coordinator(parent_class_id)
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "streaming_placement_rules_update"
  ON public.streaming_placement_rules;
CREATE POLICY "streaming_placement_rules_update"
  ON public.streaming_placement_rules FOR UPDATE
  TO authenticated
  USING (
    public.is_class_coordinator(parent_class_id)
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  )
  WITH CHECK (
    public.is_class_coordinator(parent_class_id)
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "streaming_placement_rules_delete"
  ON public.streaming_placement_rules;
CREATE POLICY "streaming_placement_rules_delete"
  ON public.streaming_placement_rules FOR DELETE
  TO authenticated
  USING (
    public.is_class_coordinator(parent_class_id)
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

-- ---------------------------------------------------------------------------
-- student_streaming_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_streaming_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  parent_class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  admission_number text,
  previous_class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  previous_class_name text NOT NULL,
  new_class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  new_class_name text NOT NULL,
  performance_measure text NOT NULL
    CHECK (performance_measure IN ('average_score', 'division', 'total_marks')),
  performance_value text NOT NULL,
  exam_type text NOT NULL,
  exam_label text NOT NULL,
  academic_year text NOT NULL,
  coordinator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  coordinator_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_streaming_history_school
  ON public.student_streaming_history (school_id);

CREATE INDEX IF NOT EXISTS idx_student_streaming_history_parent
  ON public.student_streaming_history (parent_class_id);

CREATE INDEX IF NOT EXISTS idx_student_streaming_history_student
  ON public.student_streaming_history (student_id);

CREATE INDEX IF NOT EXISTS idx_student_streaming_history_created
  ON public.student_streaming_history (created_at DESC);

ALTER TABLE public.student_streaming_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_streaming_history_select"
  ON public.student_streaming_history;
CREATE POLICY "student_streaming_history_select"
  ON public.student_streaming_history FOR SELECT
  TO authenticated
  USING (
    public.is_school_admin(school_id)
    OR public.is_super_admin()
    OR public.is_class_coordinator(parent_class_id)
  );

DROP POLICY IF EXISTS "student_streaming_history_insert"
  ON public.student_streaming_history;
CREATE POLICY "student_streaming_history_insert"
  ON public.student_streaming_history FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_class_coordinator(parent_class_id)
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.streaming_placement_rules
  TO authenticated;

GRANT SELECT, INSERT
  ON public.student_streaming_history
  TO authenticated;

GRANT ALL
  ON public.streaming_placement_rules
  TO service_role;

GRANT ALL
  ON public.student_streaming_history
  TO service_role;
