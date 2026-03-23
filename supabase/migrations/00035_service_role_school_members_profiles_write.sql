-- 00032 granted service_role SELECT only on school_members and profiles.
-- Server-side admin client operations (invite accept, remove admin, etc.) need
-- INSERT/UPDATE/DELETE on school_members and UPDATE on profiles; without these
-- PostgreSQL returns 42501 "permission denied for table school_members".

GRANT INSERT, UPDATE, DELETE ON TABLE public.school_members TO service_role;
GRANT UPDATE ON TABLE public.profiles TO service_role;
