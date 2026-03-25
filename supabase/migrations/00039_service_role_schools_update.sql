-- 00032 granted service_role SELECT only on public.schools.
-- Super-admin plan changes use the service role client; without UPDATE, PostgREST returns 42501.

GRANT UPDATE ON TABLE public.schools TO service_role;
