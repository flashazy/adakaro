-- Include plan in dashboard school payload so clients can show tier without a direct schools SELECT (avoids RLS recursion in some setups).

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
        'currency', s.currency,
        'plan', s.plan
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
        'currency', s.currency,
        'plan', s.plan
      )
      FROM public.schools s
      WHERE s.created_by = auth.uid()
      ORDER BY s.created_at ASC
      LIMIT 1
    )
  );
$$;

COMMENT ON FUNCTION public.get_my_school_for_dashboard() IS
  'Returns { school_id, name, currency, plan } for the current user (school_members first, else schools.created_by). SECURITY DEFINER; bypasses RLS.';

REVOKE ALL ON FUNCTION public.get_my_school_for_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_school_for_dashboard() TO authenticated;
