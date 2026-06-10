-- Phase 1: Syllabus coverage — topics, subtopics, and teacher progress tracking.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'syllabus_subtopic_status'
  ) THEN
    CREATE TYPE public.syllabus_subtopic_status AS ENUM (
      'not_started',
      'in_progress',
      'completed'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.syllabus_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject_name text NOT NULL DEFAULT 'Subject',
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  academic_year text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syllabus_topics_scope_idx
  ON public.syllabus_topics (school_id, class_id, subject_id, academic_year);

CREATE TABLE IF NOT EXISTS public.syllabus_subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.syllabus_topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syllabus_subtopics_topic_sort_idx
  ON public.syllabus_subtopics (topic_id, sort_order);

CREATE TABLE IF NOT EXISTS public.syllabus_subtopic_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  subtopic_id uuid NOT NULL REFERENCES public.syllabus_subtopics(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.syllabus_subtopic_status NOT NULL DEFAULT 'not_started',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subtopic_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS syllabus_subtopic_progress_scope_idx
  ON public.syllabus_subtopic_progress (school_id, class_id, subject_id, teacher_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS syllabus_topics_updated_at ON public.syllabus_topics;
CREATE TRIGGER syllabus_topics_updated_at
  BEFORE UPDATE ON public.syllabus_topics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS syllabus_subtopics_updated_at ON public.syllabus_subtopics;
CREATE TRIGGER syllabus_subtopics_updated_at
  BEFORE UPDATE ON public.syllabus_subtopics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS syllabus_subtopic_progress_updated_at ON public.syllabus_subtopic_progress;
CREATE TRIGGER syllabus_subtopic_progress_updated_at
  BEFORE UPDATE ON public.syllabus_subtopic_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Helper: teacher assigned to class + subject (cluster-aware)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_teacher_for_class_subject(
  p_class_id uuid,
  p_subject_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_assignments ta
    WHERE ta.teacher_id = auth.uid()
      AND ta.class_id IN (SELECT public.class_cluster_ids(p_class_id))
      AND (
        p_subject_id IS NULL
        OR ta.subject_id = p_subject_id
        OR (ta.subject_id IS NULL AND p_subject_id IS NOT NULL)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_for_class_subject(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_for_class_subject(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_topics TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_subtopics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_subtopics TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_subtopic_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_subtopic_progress TO service_role;

-- ---------------------------------------------------------------------------
-- RLS: syllabus_topics
-- ---------------------------------------------------------------------------
ALTER TABLE public.syllabus_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syllabus_topics_select" ON public.syllabus_topics;
CREATE POLICY "syllabus_topics_select"
  ON public.syllabus_topics FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.is_class_coordinator(class_id)
    OR public.is_school_coordinator(school_id)
    OR public.is_teacher_for_class(class_id)
    OR public.has_teacher_department_role(school_id, 'academic')
  );

DROP POLICY IF EXISTS "syllabus_topics_insert" ON public.syllabus_topics;
CREATE POLICY "syllabus_topics_insert"
  ON public.syllabus_topics FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.is_class_coordinator(class_id)
  );

DROP POLICY IF EXISTS "syllabus_topics_update" ON public.syllabus_topics;
CREATE POLICY "syllabus_topics_update"
  ON public.syllabus_topics FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.is_class_coordinator(class_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.is_class_coordinator(class_id)
  );

DROP POLICY IF EXISTS "syllabus_topics_delete" ON public.syllabus_topics;
CREATE POLICY "syllabus_topics_delete"
  ON public.syllabus_topics FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.is_class_coordinator(class_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: syllabus_subtopics (via parent topic)
-- ---------------------------------------------------------------------------
ALTER TABLE public.syllabus_subtopics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syllabus_subtopics_select" ON public.syllabus_subtopics;
CREATE POLICY "syllabus_subtopics_select"
  ON public.syllabus_subtopics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_topics t
      WHERE t.id = syllabus_subtopics.topic_id
        AND (
          public.is_super_admin()
          OR public.is_school_admin(t.school_id)
          OR public.is_class_coordinator(t.class_id)
          OR public.is_school_coordinator(t.school_id)
          OR public.is_teacher_for_class(t.class_id)
          OR public.has_teacher_department_role(t.school_id, 'academic')
        )
    )
  );

DROP POLICY IF EXISTS "syllabus_subtopics_insert" ON public.syllabus_subtopics;
CREATE POLICY "syllabus_subtopics_insert"
  ON public.syllabus_subtopics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.syllabus_topics t
      WHERE t.id = syllabus_subtopics.topic_id
        AND (
          public.is_super_admin()
          OR public.is_school_admin(t.school_id)
          OR public.is_class_coordinator(t.class_id)
        )
    )
  );

DROP POLICY IF EXISTS "syllabus_subtopics_update" ON public.syllabus_subtopics;
CREATE POLICY "syllabus_subtopics_update"
  ON public.syllabus_subtopics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_topics t
      WHERE t.id = syllabus_subtopics.topic_id
        AND (
          public.is_super_admin()
          OR public.is_school_admin(t.school_id)
          OR public.is_class_coordinator(t.class_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.syllabus_topics t
      WHERE t.id = syllabus_subtopics.topic_id
        AND (
          public.is_super_admin()
          OR public.is_school_admin(t.school_id)
          OR public.is_class_coordinator(t.class_id)
        )
    )
  );

DROP POLICY IF EXISTS "syllabus_subtopics_delete" ON public.syllabus_subtopics;
CREATE POLICY "syllabus_subtopics_delete"
  ON public.syllabus_subtopics FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_topics t
      WHERE t.id = syllabus_subtopics.topic_id
        AND (
          public.is_super_admin()
          OR public.is_school_admin(t.school_id)
          OR public.is_class_coordinator(t.class_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: syllabus_subtopic_progress
-- ---------------------------------------------------------------------------
ALTER TABLE public.syllabus_subtopic_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syllabus_subtopic_progress_select" ON public.syllabus_subtopic_progress;
CREATE POLICY "syllabus_subtopic_progress_select"
  ON public.syllabus_subtopic_progress FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.is_class_coordinator(class_id)
    OR public.is_school_coordinator(school_id)
    OR public.has_teacher_department_role(school_id, 'academic')
    OR teacher_id = auth.uid()
    OR public.is_teacher_for_class_subject(class_id, subject_id)
  );

DROP POLICY IF EXISTS "syllabus_subtopic_progress_insert" ON public.syllabus_subtopic_progress;
CREATE POLICY "syllabus_subtopic_progress_insert"
  ON public.syllabus_subtopic_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND public.is_teacher_for_class_subject(class_id, subject_id)
  );

DROP POLICY IF EXISTS "syllabus_subtopic_progress_update" ON public.syllabus_subtopic_progress;
CREATE POLICY "syllabus_subtopic_progress_update"
  ON public.syllabus_subtopic_progress FOR UPDATE
  TO authenticated
  USING (
    teacher_id = auth.uid()
    AND public.is_teacher_for_class_subject(class_id, subject_id)
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND public.is_teacher_for_class_subject(class_id, subject_id)
  );

DROP POLICY IF EXISTS "syllabus_subtopic_progress_delete" ON public.syllabus_subtopic_progress;
CREATE POLICY "syllabus_subtopic_progress_delete"
  ON public.syllabus_subtopic_progress FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_admin(school_id)
    OR public.is_class_coordinator(class_id)
  );
