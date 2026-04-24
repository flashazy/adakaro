-- Parents may only read report cards after the coordinator (or school flow)
-- releases them: status = approved. Pending review is coordinator / admin only.

DROP POLICY IF EXISTS "report_cards_select" ON public.report_cards;

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

DROP POLICY IF EXISTS "report_comments_parent_select_shared"
  ON public.teacher_report_card_comments;

CREATE POLICY "report_comments_parent_select_shared"
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
