-- Rename lifecycle status trial → setup and reclassify admin-only schools.
-- Safe to re-run: never deletes data; archived schools are untouched.

UPDATE public.schools
SET school_status = 'setup'
WHERE school_status = 'trial';

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_school_status_check;

ALTER TABLE public.schools
  ALTER COLUMN school_status SET DEFAULT 'setup';

ALTER TABLE public.schools
  ADD CONSTRAINT schools_school_status_check
  CHECK (school_status IN ('active', 'setup', 'inactive', 'archived'));

COMMENT ON COLUMN public.schools.school_status IS
  'Super Admin lifecycle: active, setup, inactive, archived. Separate from operational status.';

-- Reclassify admin-only schools that were incorrectly marked active.
UPDATE public.schools s
SET school_status = 'setup'
WHERE s.school_status = 'active'
  AND NOT EXISTS (SELECT 1 FROM public.students st WHERE st.school_id = s.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.teacher_assignments ta WHERE ta.school_id = s.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.payments p
    JOIN public.students st_pay ON st_pay.id = p.student_id
    WHERE st_pay.school_id = s.id
  )
  AND NOT EXISTS (SELECT 1 FROM public.fee_structures fs WHERE fs.school_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.report_cards rc WHERE rc.school_id = s.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.class_attendance ca WHERE ca.school_id = s.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.syllabus_subtopic_progress sp
    WHERE sp.school_id = s.id
  );

DROP FUNCTION IF EXISTS public.repair_school_lifecycle_backfill();

CREATE OR REPLACE FUNCTION public.repair_school_lifecycle_backfill()
RETURNS TABLE (
  schools_updated integer,
  status_active integer,
  status_setup integer,
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
  v_setup integer := 0;
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
      SELECT sp.updated_at FROM public.syllabus_subtopic_progress sp WHERE sp.school_id = s2.id
      UNION ALL
      SELECT sp.created_at FROM public.syllabus_subtopic_progress sp WHERE sp.school_id = s2.id
      UNION ALL
      SELECT rc.created_at FROM public.report_cards rc WHERE rc.school_id = s2.id
      UNION ALL
      SELECT rc.updated_at FROM public.report_cards rc WHERE rc.school_id = s2.id
      UNION ALL
      SELECT fs.created_at FROM public.fee_structures fs WHERE fs.school_id = s2.id
      UNION ALL
      SELECT fs.updated_at FROM public.fee_structures fs WHERE fs.school_id = s2.id
      UNION ALL
      SELECT ca.created_at FROM public.class_attendance ca WHERE ca.school_id = s2.id
      UNION ALL
      SELECT ca.updated_at FROM public.class_attendance ca WHERE ca.school_id = s2.id
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
        SELECT 1
        FROM public.payments p
        JOIN public.students st_pay ON st_pay.id = p.student_id
        WHERE st_pay.school_id = s.id
      )
      OR EXISTS (SELECT 1 FROM public.fee_structures fs WHERE fs.school_id = s.id)
      OR EXISTS (SELECT 1 FROM public.report_cards rc WHERE rc.school_id = s.id)
      OR EXISTS (SELECT 1 FROM public.class_attendance ca WHERE ca.school_id = s.id)
      OR EXISTS (
        SELECT 1 FROM public.syllabus_subtopic_progress sp WHERE sp.school_id = s.id
      )
    THEN CASE
      WHEN s.last_activity_at IS NOT NULL
        AND s.last_activity_at < (now() - interval '60 days')
      THEN 'inactive'
      ELSE 'active'
    END
    ELSE 'setup'
  END
  WHERE s.school_status IS DISTINCT FROM 'archived';

  SELECT
    COUNT(*) FILTER (WHERE school_status = 'active'),
    COUNT(*) FILTER (WHERE school_status = 'setup'),
    COUNT(*) FILTER (WHERE school_status = 'inactive'),
    COUNT(*) FILTER (WHERE school_status = 'archived')
  INTO v_active, v_setup, v_inactive, v_archived
  FROM public.schools;

  RETURN QUERY SELECT v_updated, v_active, v_setup, v_inactive, v_archived;
END;
$$;

SELECT * FROM public.repair_school_lifecycle_backfill();
