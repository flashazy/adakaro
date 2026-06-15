-- School lifecycle management for Super Admin (customer lifecycle, not deletion).
-- Distinct from schools.status (active/suspended operational gate).

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS school_status text NOT NULL DEFAULT 'setup',
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_school_status_check;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_school_status_check
  CHECK (school_status IN ('active', 'setup', 'inactive', 'archived'));

CREATE INDEX IF NOT EXISTS idx_schools_school_status ON public.schools (school_status);
CREATE INDEX IF NOT EXISTS idx_schools_last_activity_at ON public.schools (last_activity_at DESC NULLS LAST);

COMMENT ON COLUMN public.schools.school_status IS
  'Super Admin lifecycle: active, setup, inactive, archived. Separate from operational status.';
COMMENT ON COLUMN public.schools.last_activity_at IS
  'Last meaningful school activity (login, enrollment, fees, academics, etc.).';

-- Touch helper: updates last_activity_at for a school.
CREATE OR REPLACE FUNCTION public.touch_school_last_activity(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_school_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.schools
  SET last_activity_at = GREATEST(COALESCE(last_activity_at, '-infinity'::timestamptz), now()),
      updated_at = now()
  WHERE id = p_school_id;
END;
$$;

-- Backfill last_activity_at from existing operational data.
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
    SELECT p.created_at
    FROM public.payments p
    JOIN public.students st_pay ON st_pay.id = p.student_id
    WHERE st_pay.school_id = s2.id
    UNION ALL
    SELECT ta.created_at FROM public.teacher_assignments ta WHERE ta.school_id = s2.id
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
    SELECT rc.created_at
    FROM public.report_cards rc
    JOIN public.students stu ON stu.id = rc.student_id
    WHERE stu.school_id = s2.id
    UNION ALL
    SELECT fs.created_at FROM public.fee_structures fs WHERE fs.school_id = s2.id
    UNION ALL
    SELECT sm.created_at FROM public.school_members sm WHERE sm.school_id = s2.id
    UNION ALL
    SELECT s2.updated_at
  ) act ON true
  GROUP BY s2.id
) sub
WHERE s.id = sub.school_id AND sub.max_at IS NOT NULL;

-- Backfill school_status: active when operational data exists; else setup.
UPDATE public.schools s
SET school_status = CASE
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
    OR EXISTS (SELECT 1 FROM public.admin_activity_logs al WHERE al.school_id = s.id)
  THEN 'active'
  ELSE 'setup'
END
WHERE s.school_status = 'setup';

-- Triggers to maintain last_activity_at
CREATE OR REPLACE FUNCTION public.trg_touch_school_from_students()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.touch_school_last_activity(COALESCE(NEW.school_id, OLD.school_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_students_touch_school_activity ON public.students;
CREATE TRIGGER trg_students_touch_school_activity
  AFTER INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_school_from_students();

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

CREATE OR REPLACE FUNCTION public.trg_touch_school_from_teacher_assignments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.touch_school_last_activity(COALESCE(NEW.school_id, OLD.school_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_teacher_assignments_touch_school_activity ON public.teacher_assignments;
CREATE TRIGGER trg_teacher_assignments_touch_school_activity
  AFTER INSERT OR UPDATE ON public.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_school_from_teacher_assignments();

CREATE OR REPLACE FUNCTION public.trg_touch_school_from_syllabus_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT stp.school_id INTO v_school_id
  FROM public.syllabus_subtopics ss
  JOIN public.syllabus_topics stp ON stp.id = ss.topic_id
  WHERE ss.id = COALESCE(NEW.subtopic_id, OLD.subtopic_id);
  PERFORM public.touch_school_last_activity(v_school_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_syllabus_progress_touch_school_activity ON public.syllabus_subtopic_progress;
CREATE TRIGGER trg_syllabus_progress_touch_school_activity
  AFTER INSERT OR UPDATE ON public.syllabus_subtopic_progress
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_school_from_syllabus_progress();

CREATE OR REPLACE FUNCTION public.trg_touch_school_from_report_cards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.touch_school_last_activity(COALESCE(NEW.school_id, OLD.school_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_report_cards_touch_school_activity ON public.report_cards;
CREATE TRIGGER trg_report_cards_touch_school_activity
  AFTER INSERT OR UPDATE ON public.report_cards
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_school_from_report_cards();

CREATE OR REPLACE FUNCTION public.trg_touch_school_from_fee_structures()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.touch_school_last_activity(COALESCE(NEW.school_id, OLD.school_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_fee_structures_touch_school_activity ON public.fee_structures;
CREATE TRIGGER trg_fee_structures_touch_school_activity
  AFTER INSERT OR UPDATE ON public.fee_structures
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_school_from_fee_structures();

CREATE OR REPLACE FUNCTION public.trg_touch_school_from_member_login()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at AND NEW.last_sign_in_at IS NOT NULL THEN
    UPDATE public.schools s
    SET last_activity_at = GREATEST(COALESCE(s.last_activity_at, '-infinity'::timestamptz), NEW.last_sign_in_at),
        updated_at = now()
    WHERE s.id IN (SELECT sm.school_id FROM public.school_members sm WHERE sm.user_id = NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_login_touch_school_activity ON public.profiles;
CREATE TRIGGER trg_profiles_login_touch_school_activity
  AFTER UPDATE OF last_sign_in_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_school_from_member_login();
