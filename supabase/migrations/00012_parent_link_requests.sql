-- ============================================================
-- parent_link_requests table
-- Allows parents to request linking to a student by admission
-- number. Admins approve/reject from their dashboard.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.parent_link_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admission_number text        NOT NULL,
  student_id       uuid        REFERENCES public.students(id) ON DELETE CASCADE,
  school_id        uuid        REFERENCES public.schools(id) ON DELETE CASCADE,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plr_parent  ON public.parent_link_requests(parent_id);
CREATE INDEX IF NOT EXISTS idx_plr_school  ON public.parent_link_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_plr_status  ON public.parent_link_requests(status);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS parent_link_requests_updated_at ON public.parent_link_requests;
CREATE TRIGGER parent_link_requests_updated_at
  BEFORE UPDATE ON public.parent_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.parent_link_requests ENABLE ROW LEVEL SECURITY;

-- Parents can view their own requests
DROP POLICY IF EXISTS "Parents can view own requests" ON public.parent_link_requests;
CREATE POLICY "Parents can view own requests"
  ON public.parent_link_requests FOR SELECT
  USING (parent_id = auth.uid());

-- Parents can insert their own requests
DROP POLICY IF EXISTS "Parents can insert own requests" ON public.parent_link_requests;
CREATE POLICY "Parents can insert own requests"
  ON public.parent_link_requests FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- Admins can view requests for their school
DROP POLICY IF EXISTS "Admins can view school requests" ON public.parent_link_requests;
CREATE POLICY "Admins can view school requests"
  ON public.parent_link_requests FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

-- Admins can update requests for their school (approve/reject)
DROP POLICY IF EXISTS "Admins can update school requests" ON public.parent_link_requests;
CREATE POLICY "Admins can update school requests"
  ON public.parent_link_requests FOR UPDATE
  USING (school_id IN (SELECT public.user_school_ids()));

GRANT ALL ON public.parent_link_requests TO authenticated;

-- ============================================================
-- SECURITY DEFINER function to look up a student by admission
-- number without needing RLS access to the students table.
-- Returns student_id and school_id, or NULL if not found.
-- ============================================================

CREATE OR REPLACE FUNCTION public.lookup_student_by_admission(adm_number text)
RETURNS TABLE(student_id uuid, school_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id, s.school_id
  FROM public.students s
  WHERE s.admission_number = adm_number
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_student_by_admission(text) TO authenticated;
