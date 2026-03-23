-- School plan upgrade requests (school admins request; super admins approve/deny).

CREATE TABLE public.upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  current_plan text NOT NULL,
  requested_plan text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX upgrade_requests_one_pending_per_school
  ON public.upgrade_requests (school_id)
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS upgrade_requests_updated_at ON public.upgrade_requests;
CREATE TRIGGER upgrade_requests_updated_at
  BEFORE UPDATE ON public.upgrade_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;

-- Super admins see all rows
CREATE POLICY "Super admins select upgrade_requests"
  ON public.upgrade_requests FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Super admins update (approve / reject)
CREATE POLICY "Super admins update upgrade_requests"
  ON public.upgrade_requests FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- School admins see requests for their school
CREATE POLICY "School admins select own school upgrade_requests"
  ON public.upgrade_requests FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id));

-- School admins insert for their school; must be the requester
CREATE POLICY "School admins insert upgrade_requests"
  ON public.upgrade_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.is_school_admin(school_id)
  );

COMMENT ON TABLE public.upgrade_requests IS
  'Plan change requests from school admins; super admins approve or reject.';

-- Atomic review: update school plan on approve
CREATE OR REPLACE FUNCTION public.super_admin_review_upgrade_request(
  p_request_id uuid,
  p_approve boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.upgrade_requests%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO r
  FROM public.upgrade_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_resolved');
  END IF;

  IF p_approve THEN
    UPDATE public.schools
    SET plan = r.requested_plan, updated_at = now()
    WHERE id = r.school_id;

    UPDATE public.upgrade_requests
    SET status = 'approved', updated_at = now()
    WHERE id = p_request_id;
  ELSE
    UPDATE public.upgrade_requests
    SET status = 'rejected', updated_at = now()
    WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_review_upgrade_request(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_review_upgrade_request(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.super_admin_review_upgrade_request(uuid, boolean) IS
  'Super admin approves (updates school.plan) or rejects an upgrade_requests row.';

GRANT SELECT, INSERT, UPDATE ON TABLE public.upgrade_requests TO authenticated;
GRANT ALL ON TABLE public.upgrade_requests TO service_role;
