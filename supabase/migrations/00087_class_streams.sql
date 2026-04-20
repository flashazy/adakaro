-- ============================================================
-- Multi-stream support for large schools (e.g. FORM ONE -> FORM 1A / 1B / 1C).
--   * `classes.parent_class_id` lets a class be a "stream" under another class
--     (the parent acts as a virtual umbrella, child rows hold the real students).
--   * Cluster = parent class + every child stream. Helper functions resolve a
--     class id into its full cluster so existing RLS / queries automatically let
--     a teacher in any stream act on any student in the same parent group.
--   * Coordinators promoted on the parent class transparently coordinate every
--     child stream. Existing single-class coordinators keep working unchanged.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Column + index
-- ------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS parent_class_id uuid
    REFERENCES public.classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_parent
  ON public.classes (parent_class_id);

-- A class cannot be its own parent, and a parent must live in the same school.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classes_parent_not_self'
  ) THEN
    ALTER TABLE public.classes
      ADD CONSTRAINT classes_parent_not_self
      CHECK (parent_class_id IS NULL OR parent_class_id <> id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.classes_parent_same_school()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_school uuid;
BEGIN
  IF NEW.parent_class_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT school_id INTO parent_school
  FROM public.classes
  WHERE id = NEW.parent_class_id;

  IF parent_school IS NULL THEN
    RAISE EXCEPTION 'Parent class % does not exist', NEW.parent_class_id;
  END IF;

  IF parent_school <> NEW.school_id THEN
    RAISE EXCEPTION 'Parent class must belong to the same school';
  END IF;

  -- Disallow nesting beyond one level (parent of a parent must be NULL).
  IF EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = NEW.parent_class_id
      AND parent_class_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Streams cannot be nested more than one level deep';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS classes_parent_validate ON public.classes;
CREATE TRIGGER classes_parent_validate
  BEFORE INSERT OR UPDATE OF parent_class_id ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.classes_parent_same_school();

-- ------------------------------------------------------------
-- 2. Cluster helper
--    Returns every class id in the same "family" as `p_class_id`:
--      * the class itself
--      * its parent (if any)
--      * all sibling streams under that same parent
--      * all child streams when the class is itself a parent
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.class_cluster_ids(p_class_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH base AS (
    SELECT id, parent_class_id FROM public.classes WHERE id = p_class_id
  ),
  root AS (
    SELECT COALESCE((SELECT parent_class_id FROM base), p_class_id) AS root_id
  )
  SELECT c.id FROM public.classes c, root
  WHERE c.id = root.root_id
     OR c.parent_class_id = root.root_id
  UNION
  SELECT p_class_id;
$$;

REVOKE ALL ON FUNCTION public.class_cluster_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.class_cluster_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.class_cluster_ids(uuid) TO service_role;

-- ------------------------------------------------------------
-- 3. Cluster-aware teacher / coordinator helpers
--    These keep the same name + signature so existing RLS picks up the
--    new behaviour with no policy edits required elsewhere.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_teacher_for_class(p_class_id uuid)
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
  );
$$;

CREATE OR REPLACE FUNCTION public.is_class_coordinator(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_coordinators c
    WHERE c.teacher_id = auth.uid()
      AND c.class_id IN (SELECT public.class_cluster_ids(p_class_id))
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_for_class(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_for_class(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_class_coordinator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_class_coordinator(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 4. Cross-stream score writes
--    The original `teacher_scores_insert` policy required the student to be in
--    the assignment's exact class. With streams, the assignment may target the
--    parent class while the student lives in a child stream (or vice versa).
--    The cluster check covers every legal combination.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "teacher_scores_insert" ON public.teacher_scores;
CREATE POLICY "teacher_scores_insert"
  ON public.teacher_scores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teacher_gradebook_assignments g
      WHERE g.id = assignment_id
        AND g.teacher_id = auth.uid()
        AND public.is_teacher_for_class(g.class_id)
    )
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.teacher_gradebook_assignments g ON g.id = assignment_id
      WHERE s.id = student_id
        AND s.class_id IN (SELECT public.class_cluster_ids(g.class_id))
    )
  );
