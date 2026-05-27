-- Performance: indexes for promotion + coordinator dashboards, and a single-query
-- Term 2 promotion average calculator.

-- teacher_scores: grade lookups by assignment + student
CREATE INDEX IF NOT EXISTS idx_teacher_scores_assignment_student
  ON public.teacher_scores (assignment_id, student_id);

-- gradebook assignments: term-filtered class loads
CREATE INDEX IF NOT EXISTS idx_teacher_gradebook_assignments_class_year_term
  ON public.teacher_gradebook_assignments (class_id, academic_year, term);

-- report_cards: promotion + coordinator term/year filters
CREATE INDEX IF NOT EXISTS idx_report_cards_student_year_term_status
  ON public.report_cards (student_id, academic_year, term, status);

CREATE INDEX IF NOT EXISTS idx_report_cards_class_year_term
  ON public.report_cards (class_id, academic_year, term);

-- report card comments: bulk load by report_card_id (promotion + coordinator)
CREATE INDEX IF NOT EXISTS idx_teacher_report_card_comments_report_card_id
  ON public.teacher_report_card_comments (report_card_id);

/**
 * Computes Term 2 promotion stats for a class roster in one database round-trip.
 * Mirrors lib/promotions/compute-term2-report-card-averages.ts (exact subject name match).
 */
CREATE OR REPLACE FUNCTION public.compute_class_term2_promotion_stats(
  p_class_id uuid,
  p_academic_year text,
  p_student_ids uuid[]
)
RETURNS TABLE (
  student_id uuid,
  has_term2_report_card boolean,
  term2_report_card_status text,
  can_promote boolean,
  term2_average_percent numeric,
  subjects_count integer
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_subjects_count integer;
BEGIN
  SELECT count(DISTINCT lower(trim(s.name)))::integer
  INTO v_subjects_count
  FROM public.subject_classes sc
  JOIN public.subjects s ON s.id = sc.subject_id
  WHERE sc.class_id = p_class_id
    AND trim(COALESCE(s.name, '')) <> '';

  RETURN QUERY
  WITH students_input AS (
    SELECT unnest(COALESCE(p_student_ids, ARRAY[]::uuid[])) AS student_id
  ),
  class_subjects AS (
    SELECT DISTINCT lower(trim(s.name)) AS subject_key
    FROM public.subject_classes sc
    JOIN public.subjects s ON s.id = sc.subject_id
    WHERE sc.class_id = p_class_id
      AND trim(COALESCE(s.name, '')) <> ''
  ),
  cards AS (
    SELECT rc.id, rc.student_id, rc.status
    FROM public.report_cards rc
    WHERE rc.term = 'Term 2'
      AND rc.academic_year = trim(p_academic_year)
      AND (
        p_student_ids IS NULL
        OR cardinality(p_student_ids) = 0
        OR rc.student_id = ANY (p_student_ids)
      )
  ),
  comment_subject_avg AS (
    SELECT
      c.report_card_id,
      COALESCE(
        c.calculated_score,
        CASE
          WHEN c.exam1_score IS NOT NULL AND c.exam2_score IS NOT NULL
          THEN round(((c.exam1_score + c.exam2_score) / 2.0)::numeric, 1)
          ELSE NULL
        END,
        c.score_percent
      ) AS subject_avg
    FROM public.teacher_report_card_comments c
    INNER JOIN cards ON cards.id = c.report_card_id
    INNER JOIN class_subjects cs ON lower(trim(c.subject)) = cs.subject_key
  ),
  card_subject_sums AS (
    SELECT
      cards.student_id,
      cards.status,
      COALESCE(sum(COALESCE(csa.subject_avg, 0)), 0)::numeric AS subject_sum
    FROM cards
    LEFT JOIN comment_subject_avg csa ON csa.report_card_id = cards.id
    GROUP BY cards.student_id, cards.status
  )
  SELECT
    si.student_id,
    (css.student_id IS NOT NULL) AS has_term2_report_card,
    CASE
      WHEN css.student_id IS NULL THEN 'not_generated'
      WHEN css.status = 'approved' THEN 'approved'
      ELSE 'pending_approval'
    END AS term2_report_card_status,
    (css.status = 'approved') AS can_promote,
    CASE
      WHEN v_subjects_count > 0 AND css.student_id IS NOT NULL
      THEN round((css.subject_sum / v_subjects_count::numeric), 1)
      ELSE NULL::numeric
    END AS term2_average_percent,
    v_subjects_count AS subjects_count
  FROM students_input si
  LEFT JOIN card_subject_sums css ON css.student_id = si.student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_class_term2_promotion_stats(uuid, text, uuid[])
  TO authenticated, service_role;
