-- Per-parent, per-student, per-assignment "last viewed" for Subject results (class gradebook).
-- Unread state is derived by comparing this with assignment + teacher_scores activity
-- (no separate queue table).

CREATE TABLE public.parent_viewed_results (
  parent_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  subject text NOT NULL,
  assignment_id uuid NOT NULL REFERENCES public.teacher_gradebook_assignments (id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, student_id, assignment_id)
);

CREATE INDEX idx_parent_viewed_results_parent_student
  ON public.parent_viewed_results (parent_id, student_id);

CREATE INDEX idx_parent_viewed_results_assignment
  ON public.parent_viewed_results (assignment_id);

ALTER TABLE public.parent_viewed_results ENABLE ROW LEVEL SECURITY;

-- Parents may read their own view rows (must be linked to the student)
CREATE POLICY "parent_viewed_results_select_own"
  ON public.parent_viewed_results FOR SELECT
  USING (
    parent_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.parent_students ps
      WHERE ps.parent_id = auth.uid()
        AND ps.student_id = public.parent_viewed_results.student_id
    )
  );

-- Insert when marking viewed (valid parent–student and assignment in student’s class cluster is enforced in app)
CREATE POLICY "parent_viewed_results_insert_own"
  ON public.parent_viewed_results FOR INSERT
  WITH CHECK (
    parent_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.parent_students ps
      WHERE ps.parent_id = auth.uid()
        AND ps.student_id = public.parent_viewed_results.student_id
    )
  );

-- Allow updating viewed_at
CREATE POLICY "parent_viewed_results_update_own"
  ON public.parent_viewed_results FOR UPDATE
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.parent_viewed_results TO authenticated;

