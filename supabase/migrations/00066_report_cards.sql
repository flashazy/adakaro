-- Report cards workflow (per student / term / year) + term + optional scores on comments.

CREATE TABLE public.report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  term text NOT NULL DEFAULT 'Term 1',
  academic_year text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'pending_review', 'approved', 'changes_requested')
  ),
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_cards_student_term_year_unique UNIQUE (student_id, term, academic_year)
);

CREATE INDEX idx_report_cards_school_status ON public.report_cards (school_id, status);
CREATE INDEX idx_report_cards_class ON public.report_cards (class_id);

CREATE TRIGGER report_cards_updated_at
  BEFORE UPDATE ON public.report_cards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_cards_select"
  ON public.report_cards FOR SELECT
  USING (
    public.is_teacher_for_class(class_id)
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
    OR (
      status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.parent_students ps
        WHERE ps.parent_id = auth.uid()
          AND ps.student_id = report_cards.student_id
      )
    )
  );

CREATE POLICY "report_cards_insert"
  ON public.report_cards FOR INSERT
  WITH CHECK (
    auth.uid() = teacher_id
    AND public.is_teacher_for_school(school_id)
    AND public.is_teacher_for_class(class_id)
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
        AND s.class_id = class_id
        AND s.school_id = school_id
    )
  );

CREATE POLICY "report_cards_update"
  ON public.report_cards FOR UPDATE
  USING (
    public.is_school_admin(school_id)
    OR public.is_super_admin()
    OR (
      public.is_teacher_for_class(class_id)
      AND (
        status IN ('draft', 'changes_requested')
        OR auth.uid() = teacher_id
      )
    )
  );

CREATE POLICY "report_cards_delete"
  ON public.report_cards FOR DELETE
  USING (
    (auth.uid() = teacher_id AND public.is_teacher_for_class(class_id))
    OR public.is_school_admin(school_id)
    OR public.is_super_admin()
  );

ALTER TABLE public.teacher_report_card_comments
  ADD COLUMN IF NOT EXISTS term text NOT NULL DEFAULT 'Term 1',
  ADD COLUMN IF NOT EXISTS report_card_id uuid REFERENCES public.report_cards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS score_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS letter_grade text;

ALTER TABLE public.teacher_report_card_comments
  DROP CONSTRAINT IF EXISTS teacher_report_card_comments_teacher_id_student_id_subject_academic_year_key;

ALTER TABLE public.teacher_report_card_comments
  ADD CONSTRAINT teacher_report_card_comments_teacher_student_subject_year_term_key
  UNIQUE (teacher_id, student_id, subject, academic_year, term);

-- Backfill report_cards from existing comments (one row per student / academic year / Term 1).
INSERT INTO public.report_cards (
  student_id,
  class_id,
  school_id,
  teacher_id,
  term,
  academic_year,
  status,
  submitted_at,
  approved_at
)
SELECT DISTINCT ON (s.id, c.academic_year)
  s.id,
  s.class_id,
  s.school_id,
  c.teacher_id,
  'Term 1',
  c.academic_year,
  CASE c.status
    WHEN 'approved' THEN 'approved'
    WHEN 'submitted' THEN 'pending_review'
    ELSE 'draft'
  END::text,
  CASE WHEN c.status = 'submitted' THEN c.updated_at ELSE NULL END,
  CASE WHEN c.status = 'approved' THEN c.updated_at ELSE NULL END
FROM public.teacher_report_card_comments c
JOIN public.students s ON s.id = c.student_id
ORDER BY s.id, c.academic_year, c.created_at ASC
ON CONFLICT (student_id, term, academic_year) DO NOTHING;

UPDATE public.teacher_report_card_comments c
SET
  term = COALESCE(NULLIF(trim(c.term), ''), 'Term 1'),
  report_card_id = rc.id
FROM public.report_cards rc
WHERE rc.student_id = c.student_id
  AND rc.academic_year = c.academic_year
  AND rc.term = COALESCE(NULLIF(trim(c.term), ''), 'Term 1');

INSERT INTO public.report_cards (
  student_id,
  class_id,
  school_id,
  teacher_id,
  term,
  academic_year,
  status
)
SELECT s.id,
  s.class_id,
  s.school_id,
  c.teacher_id,
  COALESCE(NULLIF(trim(c.term), ''), 'Term 1'),
  c.academic_year,
  'draft'
FROM public.teacher_report_card_comments c
JOIN public.students s ON s.id = c.student_id
WHERE c.report_card_id IS NULL
ON CONFLICT (student_id, term, academic_year) DO NOTHING;

UPDATE public.teacher_report_card_comments c
SET report_card_id = rc.id
FROM public.report_cards rc
WHERE c.report_card_id IS NULL
  AND rc.student_id = c.student_id
  AND rc.academic_year = c.academic_year
  AND rc.term = COALESCE(NULLIF(trim(c.term), ''), 'Term 1');

ALTER TABLE public.teacher_report_card_comments
  ALTER COLUMN report_card_id SET NOT NULL;

CREATE POLICY "report_comments_parent_select_approved"
  ON public.teacher_report_card_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.report_cards rc
      JOIN public.parent_students ps
        ON ps.student_id = rc.student_id AND ps.parent_id = auth.uid()
      WHERE rc.id = teacher_report_card_comments.report_card_id
        AND rc.status = 'approved'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_cards TO authenticated;
GRANT ALL ON public.report_cards TO service_role;
