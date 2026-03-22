-- Admin visibility + mutations for parent_link_requests via SECURITY DEFINER.
-- Direct SELECT was still empty for some admins because RLS policies that
-- subquery `students` run as the invoker and can fail to see the student row.

-- ---------------------------------------------------------------------------
-- List pending requests the current user is allowed to act on
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
    AND (
      public.is_school_admin(plr.school_id)
      OR (
        plr.student_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.students s
          WHERE s.id = plr.student_id
            AND public.is_school_admin(s.school_id)
        )
      )
    )
  ORDER BY plr.created_at DESC;
$$;

COMMENT ON FUNCTION public.get_pending_parent_link_requests_for_admin() IS
  'Pending link requests for schools the caller admins (by request.school_id or student.school_id).';

REVOKE ALL ON FUNCTION public.get_pending_parent_link_requests_for_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_parent_link_requests_for_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- Approve: link parent to student + mark request approved
-- ---------------------------------------------------------------------------
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
    AND (
      public.is_school_admin(plr.school_id)
      OR (
        plr.student_id IS NOT NULL
        AND public.is_school_admin(
          (SELECT s.school_id FROM public.students s WHERE s.id = plr.student_id LIMIT 1)
        )
      )
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

REVOKE ALL ON FUNCTION public.admin_approve_parent_link_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_parent_link_request(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Reject
-- ---------------------------------------------------------------------------
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
    AND (
      public.is_school_admin(plr.school_id)
      OR (
        plr.student_id IS NOT NULL
        AND public.is_school_admin(
          (SELECT s.school_id FROM public.students s WHERE s.id = plr.student_id LIMIT 1)
        )
      )
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

REVOKE ALL ON FUNCTION public.admin_reject_parent_link_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reject_parent_link_request(uuid) TO authenticated;
