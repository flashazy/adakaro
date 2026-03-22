-- Fix admin not seeing pending requests when:
--   • request.school_id points at the wrong school (global admission lookup picked another school), or
--   • only admission_number matches a student in the admin's school.
-- Also: prefer parent's linked school when resolving admission globally.
-- Parents: allow deleting own pending rows so they can resubmit after a bad match.

-- Replace single-arg lookup with (text, uuid default null) so preferred school works.
DROP FUNCTION IF EXISTS public.lookup_student_by_admission(text);

-- ---------------------------------------------------------------------------
-- Visibility helper (SECURITY DEFINER; used by RPCs + RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_pending_parent_link_request_visible(
  p_school_id uuid,
  p_student_id uuid,
  p_admission_number text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (p_school_id IS NOT NULL AND public.is_school_admin(p_school_id))
    OR (
      p_student_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.students s
        WHERE s.id = p_student_id
          AND public.is_school_admin(s.school_id)
      )
    )
    OR (
      trim(COALESCE(p_admission_number, '')) <> ''
      AND EXISTS (
        SELECT 1
        FROM public.students s
        WHERE lower(trim(s.admission_number)) = lower(trim(COALESCE(p_admission_number, '')))
          AND trim(COALESCE(s.admission_number, '')) <> ''
          AND public.is_school_admin(s.school_id)
      )
    );
$$;

COMMENT ON FUNCTION public.admin_pending_parent_link_request_visible(uuid, uuid, text) IS
  'True if the caller is a school admin for this pending row (by school_id, student row, or admission match).';

REVOKE ALL ON FUNCTION public.admin_pending_parent_link_request_visible(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_pending_parent_link_request_visible(uuid, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Admission lookup: optional preferred school (parent already linked to a child)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_student_by_admission(
  adm_number text,
  p_prefer_school_id uuid DEFAULT NULL
)
RETURNS TABLE (student_id uuid, school_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.school_id
  FROM public.students s
  WHERE lower(trim(s.admission_number)) = lower(trim(COALESCE(adm_number, '')))
    AND trim(COALESCE(s.admission_number, '')) <> ''
  ORDER BY
    CASE
      WHEN p_prefer_school_id IS NOT NULL AND s.school_id = p_prefer_school_id THEN 0
      ELSE 1
    END,
    s.created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.lookup_student_by_admission(text, uuid) IS
  'Resolve student by admission (trimmed, case-insensitive). Prefer p_prefer_school_id when duplicates exist globally.';

REVOKE ALL ON FUNCTION public.lookup_student_by_admission(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_student_by_admission(text, uuid) TO authenticated;
-- Keep one-arg calls working: default NULL for second param (Postgres picks (text,uuid) with default).

-- ---------------------------------------------------------------------------
-- RPCs: use visibility helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pending_parent_link_requests_for_admin()
RETURNS TABLE (
  id uuid,
  parent_id uuid,
  admission_number text,
  student_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plr.id, plr.parent_id, plr.admission_number, plr.student_id, plr.created_at
  FROM public.parent_link_requests plr
  WHERE plr.status = 'pending'
    AND public.admin_pending_parent_link_request_visible(
      plr.school_id,
      plr.student_id,
      plr.admission_number
    )
  ORDER BY plr.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_parent_link_request(
  p_request_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.is_school_admin(
    (SELECT s.school_id FROM public.students s WHERE s.id = p_student_id LIMIT 1)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized for this student');
  END IF;

  SELECT plr.parent_id
  INTO v_parent_id
  FROM public.parent_link_requests plr
  WHERE plr.id = p_request_id
    AND plr.status = 'pending'
    AND public.admin_pending_parent_link_request_visible(
      plr.school_id,
      plr.student_id,
      plr.admission_number
    );

  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found or not authorized');
  END IF;

  INSERT INTO public.parent_students (parent_id, student_id)
  VALUES (v_parent_id, p_student_id)
  ON CONFLICT (parent_id, student_id) DO NOTHING;

  UPDATE public.parent_link_requests
  SET status = 'approved', updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_parent_link_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  UPDATE public.parent_link_requests plr
  SET status = 'rejected', updated_at = now()
  WHERE plr.id = p_request_id
    AND plr.status = 'pending'
    AND public.admin_pending_parent_link_request_visible(
      plr.school_id,
      plr.student_id,
      plr.admission_number
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found or not authorized');
  END IF;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS: admins can SELECT/UPDATE pending rows using same visibility (fixes fallback .from() without RPC)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins select pending link requests definer visibility" ON public.parent_link_requests;
CREATE POLICY "Admins select pending link requests definer visibility"
  ON public.parent_link_requests FOR SELECT
  USING (
    status = 'pending'
    AND public.admin_pending_parent_link_request_visible(school_id, student_id, admission_number)
  );

DROP POLICY IF EXISTS "Admins update pending link requests definer visibility" ON public.parent_link_requests;
CREATE POLICY "Admins update pending link requests definer visibility"
  ON public.parent_link_requests FOR UPDATE
  USING (
    status = 'pending'
    AND public.admin_pending_parent_link_request_visible(school_id, student_id, admission_number)
  )
  WITH CHECK (
    public.admin_pending_parent_link_request_visible(school_id, student_id, admission_number)
  );

-- ---------------------------------------------------------------------------
-- Parents: delete stuck pending requests
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Parents delete own pending requests" ON public.parent_link_requests;
CREATE POLICY "Parents delete own pending requests"
  ON public.parent_link_requests FOR DELETE
  USING (parent_id = auth.uid() AND status = 'pending');
