-- Dashboard school title: return name + currency for the user's primary school.
-- Uses SECURITY DEFINER + get_my_school_id() so this works even when direct
-- SELECT on public.schools is finicky for the anon/authenticated role under RLS.

CREATE OR REPLACE FUNCTION public.get_my_school_for_dashboard()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'school_id', s.id,
    'name', s.name,
    'currency', s.currency
  )
  FROM public.schools s
  WHERE s.id = public.get_my_school_id()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_school_for_dashboard() IS
  'Returns { school_id, name, currency } for auth user''s primary school (via get_my_school_id). Bypasses RLS for the schools row read.';

REVOKE ALL ON FUNCTION public.get_my_school_for_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_school_for_dashboard() TO authenticated;
