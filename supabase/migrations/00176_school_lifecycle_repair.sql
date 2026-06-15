-- Repair school lifecycle backfill and fix payments trigger (payments has no school_id).
-- Safe to re-run: does not delete schools; archived status is never changed.

-- Fix payments trigger: resolve school via student_id.
CREATE OR REPLACE FUNCTION public.trg_touch_school_from_payments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT st.school_id INTO v_school_id
  FROM public.students st
  WHERE st.id = COALESCE(NEW.student_id, OLD.student_id);
  PERFORM public.touch_school_last_activity(v_school_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_touch_school_activity ON public.payments;
CREATE TRIGGER trg_payments_touch_school_activity
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_school_from_payments();

-- One-shot repair: recompute last_activity_at and school_status from existing data.
CREATE OR REPLACE FUNCTION public.repair_school_lifecycle_backfill()
RETURNS TABLE (
  schools_updated integer,
  status_active integer,
  status_trial integer,
  status_inactive integer,
  status_archived integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
  v_active integer := 0;
  v_trial integer := 0;
  v_inactive integer := 0;
  v_archived integer := 0;
BEGIN
  UPDATE public.schools s
  SET last_activity_at = sub.max_at
  FROM (
    SELECT
      s2.id AS school_id,
      MAX(act.activity_at) AS max_at
    FROM public.schools s2
    LEFT JOIN LATERAL (
      SELECT st.created_at AS activity_at FROM public.students st WHERE st.school_id = s2.id
      UNION ALL
      SELECT st.updated_at FROM public.students st WHERE st.school_id = s2.id
      UNION ALL
      SELECT p.created_at
      FROM public.payments p
      JOIN public.students st_pay ON st_pay.id = p.student_id
      WHERE st_pay.school_id = s2.id
      UNION ALL
      SELECT p.updated_at
      FROM public.payments p
      JOIN public.students st_pay ON st_pay.id = p.student_id
      WHERE st_pay.school_id = s2.id
      UNION ALL
      SELECT ta.created_at FROM public.teacher_assignments ta WHERE ta.school_id = s2.id
      UNION ALL
      SELECT sm.created_at FROM public.school_members sm WHERE sm.school_id = s2.id
      UNION ALL
      SELECT al.created_at FROM public.admin_activity_logs al WHERE al.school_id = s2.id
      UNION ALL
      SELECT pr.last_sign_in_at
      FROM public.school_members sm
      JOIN public.profiles pr ON pr.id = sm.user_id
      WHERE sm.school_id = s2.id AND pr.last_sign_in_at IS NOT NULL
      UNION ALL
      SELECT sp.updated_at
      FROM public.syllabus_subtopic_progress sp
      JOIN public.syllabus_subtopics ss ON ss.id = sp.subtopic_id
      JOIN public.syllabus_topics stp ON stp.id = ss.topic_id
      WHERE stp.school_id = s2.id
      UNION ALL
      SELECT sp.created_at
      FROM public.syllabus_subtopic_progress sp
      JOIN public.syllabus_subtopics ss ON ss.id = sp.subtopic_id
      JOIN public.syllabus_topics stp ON stp.id = ss.topic_id
      WHERE stp.school_id = s2.id
      UNION ALL
      SELECT rc.created_at FROM public.report_cards rc WHERE rc.school_id = s2.id
      UNION ALL
      SELECT rc.updated_at FROM public.report_cards rc WHERE rc.school_id = s2.id
      UNION ALL
      SELECT fs.created_at FROM public.fee_structures fs WHERE fs.school_id = s2.id
      UNION ALL
      SELECT fs.updated_at FROM public.fee_structures fs WHERE fs.school_id = s2.id
      UNION ALL
      SELECT s2.updated_at
      UNION ALL
      SELECT s2.created_at
    ) act ON true
    GROUP BY s2.id
  ) sub
  WHERE s.id = sub.school_id AND sub.max_at IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.schools s
  SET school_status = CASE
    WHEN s.school_status = 'archived' THEN 'archived'
    WHEN EXISTS (SELECT 1 FROM public.students st WHERE st.school_id = s.id)
      OR EXISTS (SELECT 1 FROM public.teacher_assignments ta WHERE ta.school_id = s.id)
      OR EXISTS (
        SELECT 1 FROM public.school_members sm WHERE sm.school_id = s.id AND sm.role = 'admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.payments p
        JOIN public.students st_pay ON st_pay.id = p.student_id
        WHERE st_pay.school_id = s.id
      )
      OR EXISTS (SELECT 1 FROM public.fee_structures fs WHERE fs.school_id = s.id)
      OR EXISTS (SELECT 1 FROM public.report_cards rc WHERE rc.school_id = s.id)
      OR EXISTS (
        SELECT 1
        FROM public.syllabus_subtopic_progress sp
        JOIN public.syllabus_subtopics ss ON ss.id = sp.subtopic_id
        JOIN public.syllabus_topics stp ON stp.id = ss.topic_id
        WHERE stp.school_id = s.id
      )
      OR EXISTS (SELECT 1 FROM public.admin_activity_logs al WHERE al.school_id = s.id)
      OR EXISTS (
        SELECT 1
        FROM public.school_members sm
        JOIN public.profiles pr ON pr.id = sm.user_id
        WHERE sm.school_id = s.id AND pr.last_sign_in_at IS NOT NULL
      )
    THEN 'active'
    WHEN s.last_activity_at IS NULL
      OR s.last_activity_at < (now() - interval '60 days')
    THEN 'inactive'
    ELSE 'trial'
  END
  WHERE s.school_status IS DISTINCT FROM 'archived';

  SELECT
    COUNT(*) FILTER (WHERE school_status = 'active'),
    COUNT(*) FILTER (WHERE school_status = 'trial'),
    COUNT(*) FILTER (WHERE school_status = 'inactive'),
    COUNT(*) FILTER (WHERE school_status = 'archived')
  INTO v_active, v_trial, v_inactive, v_archived
  FROM public.schools;

  RETURN QUERY SELECT v_updated, v_active, v_trial, v_inactive, v_archived;
END;
$$;

COMMENT ON FUNCTION public.repair_school_lifecycle_backfill() IS
  'Recomputes schools.last_activity_at and school_status from existing operational data. Safe to re-run.';

REVOKE ALL ON FUNCTION public.repair_school_lifecycle_backfill() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_school_lifecycle_backfill() TO service_role;

-- Run repair immediately for existing deployments.
SELECT * FROM public.repair_school_lifecycle_backfill();
