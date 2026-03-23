-- Prefer membership JOIN (explicit) over nested get_my_school_id(); COALESCE with
-- orphan schools.created_by so founders always see their school name on the dashboard.

CREATE OR REPLACE FUNCTION public.get_my_school_for_dashboard()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'school_id', s.id,
        'name', s.name,
        'currency', s.currency
      )
      FROM public.school_members sm
      INNER JOIN public.schools s ON s.id = sm.school_id
      WHERE sm.user_id = auth.uid()
      ORDER BY sm.created_at ASC
      LIMIT 1
    ),
    (
      SELECT jsonb_build_object(
        'school_id', s.id,
        'name', s.name,
        'currency', s.currency
      )
      FROM public.schools s
      WHERE s.created_by = auth.uid()
      ORDER BY s.created_at ASC
      LIMIT 1
    )
  );
$$;

COMMENT ON FUNCTION public.get_my_school_for_dashboard() IS
  'Returns { school_id, name, currency } for the current user (school_members first, else schools.created_by). SECURITY DEFINER; bypasses RLS.';

REVOKE ALL ON FUNCTION public.get_my_school_for_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_school_for_dashboard() TO authenticated;
