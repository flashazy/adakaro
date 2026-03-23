-- Ensure PostgREST requests authenticated as service_role can read core tables.
-- Fixes "permission denied for table …" when using SUPABASE_SERVICE_ROLE_KEY with
-- supabase-js on self-hosted or restored projects where defaults differ.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT ON TABLE public.schools TO service_role;
GRANT SELECT ON TABLE public.students TO service_role;
GRANT SELECT ON TABLE public.school_members TO service_role;
GRANT SELECT ON TABLE public.payments TO service_role;
GRANT SELECT ON TABLE public.profiles TO service_role;
GRANT SELECT ON TABLE public.school_invitations TO service_role;
