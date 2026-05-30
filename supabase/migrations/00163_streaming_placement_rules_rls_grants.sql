-- Fix "permission denied for table streaming_placement_rules" (42501) and widen
-- RLS so school admins, class coordinators (any class in the school), and
-- academic department staff can manage streaming rules for their school.

-- ---------------------------------------------------------------------------
-- Helper: is_school_coordinator
-- True when auth user coordinates at least one class in the school.
-- Matches coordinator streaming access (not limited to a single parent class).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_school_coordinator(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_coordinators c
    WHERE c.school_id = p_school_id
      AND c.teacher_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_school_coordinator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_coordinator(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- streaming_placement_rules — table privileges (idempotent)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.streaming_placement_rules
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.streaming_placement_rules
  TO service_role;

-- ---------------------------------------------------------------------------
-- streaming_placement_rules — RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "streaming_placement_rules_select"
  ON public.streaming_placement_rules;
CREATE POLICY "streaming_placement_rules_select"
  ON public.streaming_placement_rules FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
    OR public.is_class_coordinator(parent_class_id)
    OR public.is_school_coordinator(school_id)
  );

DROP POLICY IF EXISTS "streaming_placement_rules_insert"
  ON public.streaming_placement_rules;
CREATE POLICY "streaming_placement_rules_insert"
  ON public.streaming_placement_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
    OR public.is_class_coordinator(parent_class_id)
    OR public.is_school_coordinator(school_id)
  );

DROP POLICY IF EXISTS "streaming_placement_rules_update"
  ON public.streaming_placement_rules;
CREATE POLICY "streaming_placement_rules_update"
  ON public.streaming_placement_rules FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
    OR public.is_class_coordinator(parent_class_id)
    OR public.is_school_coordinator(school_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
    OR public.is_class_coordinator(parent_class_id)
    OR public.is_school_coordinator(school_id)
  );

DROP POLICY IF EXISTS "streaming_placement_rules_delete"
  ON public.streaming_placement_rules;
CREATE POLICY "streaming_placement_rules_delete"
  ON public.streaming_placement_rules FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
    OR public.is_class_coordinator(parent_class_id)
    OR public.is_school_coordinator(school_id)
  );

-- ---------------------------------------------------------------------------
-- student_streaming_history — table privileges (idempotent)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT
  ON TABLE public.student_streaming_history
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.student_streaming_history
  TO service_role;

-- ---------------------------------------------------------------------------
-- student_streaming_history — RLS (align with rules access)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "student_streaming_history_select"
  ON public.student_streaming_history;
CREATE POLICY "student_streaming_history_select"
  ON public.student_streaming_history FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
    OR public.is_class_coordinator(parent_class_id)
    OR public.is_school_coordinator(school_id)
  );

DROP POLICY IF EXISTS "student_streaming_history_insert"
  ON public.student_streaming_history;
CREATE POLICY "student_streaming_history_insert"
  ON public.student_streaming_history FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
    OR public.is_class_coordinator(parent_class_id)
    OR public.is_school_coordinator(school_id)
  );
