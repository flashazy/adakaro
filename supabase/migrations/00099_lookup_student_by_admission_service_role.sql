-- Parent forgot-password flow calls lookup_student_by_admission via createAdminClient
-- (PostgREST role: service_role). 00026 granted EXECUTE only to authenticated.
GRANT EXECUTE ON FUNCTION public.lookup_student_by_admission(text, uuid) TO service_role;
