-- Fix: admins not seeing parent link requests when:
--  • school_id on the row is NULL (legacy / bad data), or
--  • admin "primary" school from get_my_school_id ≠ request.school_id, or
--  • admission lookup should trim + case-fold for matching.

-- ---------------------------------------------------------------------------
-- 1) Stricter parent insert: require resolved student + school (keeps RLS happy)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Parents can insert own requests" ON public.parent_link_requests;
CREATE POLICY "Parents can insert own requests"
  ON public.parent_link_requests FOR INSERT
  WITH CHECK (
    parent_id = auth.uid()
    AND school_id IS NOT NULL
    AND student_id IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- 2) Admins can SELECT requests for their school via student row (covers NULL school_id)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins select link requests via student school" ON public.parent_link_requests;
CREATE POLICY "Admins select link requests via student school"
  ON public.parent_link_requests FOR SELECT
  USING (
    student_id IS NOT NULL
    AND public.is_school_admin(
      (SELECT s.school_id FROM public.students s WHERE s.id = parent_link_requests.student_id LIMIT 1)
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Admins can UPDATE (approve/reject) same way when school_id column is wrong/null
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins update link requests via student school" ON public.parent_link_requests;
CREATE POLICY "Admins update link requests via student school"
  ON public.parent_link_requests FOR UPDATE
  USING (
    student_id IS NOT NULL
    AND public.is_school_admin(
      (SELECT s.school_id FROM public.students s WHERE s.id = parent_link_requests.student_id LIMIT 1)
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Normalize admission lookup (trim + case-insensitive)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_student_by_admission(adm_number text)
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
  ORDER BY s.created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.lookup_student_by_admission(text) IS
  'Resolves student_id and school_id by admission number (trimmed, case-insensitive). SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 5) Backfill pending rows missing student_id / school_id (single student match only)
-- ---------------------------------------------------------------------------
WITH match AS (
  SELECT
    plr.id AS plr_id,
    (array_agg(s.id ORDER BY s.created_at ASC))[1] AS sid,
    (array_agg(s.school_id ORDER BY s.created_at ASC))[1] AS scid,
    count(*)::int AS c
  FROM public.parent_link_requests plr
  INNER JOIN public.students s
    ON lower(trim(s.admission_number)) = lower(trim(COALESCE(plr.admission_number, '')))
    AND trim(COALESCE(s.admission_number, '')) <> ''
  WHERE plr.status = 'pending'
    AND trim(COALESCE(plr.admission_number, '')) <> ''
    AND (plr.student_id IS NULL OR plr.school_id IS NULL)
  GROUP BY plr.id
  HAVING count(*) = 1
)
UPDATE public.parent_link_requests plr
SET
  student_id = match.sid,
  school_id = match.scid
FROM match
WHERE plr.id = match.plr_id;
