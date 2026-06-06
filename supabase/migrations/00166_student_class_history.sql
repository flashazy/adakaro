-- Unified audit of student class/stream changes. Does not move attendance, marks, or report cards.

CREATE TABLE IF NOT EXISTS public.student_class_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  to_class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  effective_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('streaming', 'promotion', 'admin_edit')),
  source_id uuid,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  academic_year text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_class_history_school_student
  ON public.student_class_history (school_id, student_id);

CREATE INDEX IF NOT EXISTS idx_student_class_history_school_from_class
  ON public.student_class_history (school_id, from_class_id)
  WHERE from_class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_class_history_school_to_class
  ON public.student_class_history (school_id, to_class_id);

CREATE INDEX IF NOT EXISTS idx_student_class_history_student_effective
  ON public.student_class_history (student_id, effective_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_class_history_source_id_unique
  ON public.student_class_history (source, source_id)
  WHERE source_id IS NOT NULL;

COMMENT ON TABLE public.student_class_history IS
  'Append-only log when a student''s class_id changes (streaming, promotion, admin edit).';

COMMENT ON COLUMN public.student_class_history.source_id IS
  'Optional link to student_streaming_history.id or student_promotions.id when applicable.';

-- ---------------------------------------------------------------------------
-- Backfill from existing audit tables (idempotent)
-- ---------------------------------------------------------------------------

INSERT INTO public.student_class_history (
  school_id,
  student_id,
  from_class_id,
  to_class_id,
  effective_at,
  source,
  source_id,
  actor_id,
  academic_year
)
SELECT
  sh.school_id,
  sh.student_id,
  sh.previous_class_id,
  sh.new_class_id,
  sh.created_at,
  'streaming',
  sh.id,
  sh.coordinator_id,
  sh.academic_year
FROM public.student_streaming_history sh
WHERE sh.previous_class_id IS DISTINCT FROM sh.new_class_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.student_class_history h
    WHERE h.source = 'streaming'
      AND h.source_id = sh.id
  );

INSERT INTO public.student_class_history (
  school_id,
  student_id,
  from_class_id,
  to_class_id,
  effective_at,
  source,
  source_id,
  actor_id,
  academic_year
)
SELECT
  sp.school_id,
  sp.student_id,
  sp.from_class_id,
  sp.to_class_id,
  sp.promoted_at,
  'promotion',
  sp.id,
  sp.promoted_by,
  sp.academic_year::text
FROM public.student_promotions sp
WHERE sp.decision = 'promote'
  AND sp.to_class_id IS NOT NULL
  AND sp.from_class_id IS DISTINCT FROM sp.to_class_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.student_class_history h
    WHERE h.source = 'promotion'
      AND h.source_id = sp.id
  );

-- ---------------------------------------------------------------------------
-- RLS (no broad class-teacher read access)
-- ---------------------------------------------------------------------------

ALTER TABLE public.student_class_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_class_history_select ON public.student_class_history;
CREATE POLICY student_class_history_select
  ON public.student_class_history FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
    OR public.is_school_coordinator(school_id)
    OR (
      from_class_id IS NOT NULL
      AND public.is_class_coordinator(from_class_id)
    )
    OR public.is_class_coordinator(to_class_id)
  );

DROP POLICY IF EXISTS student_class_history_insert ON public.student_class_history;
CREATE POLICY student_class_history_insert
  ON public.student_class_history FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
    OR public.is_school_coordinator(school_id)
    OR (
      from_class_id IS NOT NULL
      AND public.is_class_coordinator(from_class_id)
    )
    OR public.is_class_coordinator(to_class_id)
  );

GRANT SELECT, INSERT ON TABLE public.student_class_history TO authenticated;
GRANT ALL ON TABLE public.student_class_history TO service_role;
