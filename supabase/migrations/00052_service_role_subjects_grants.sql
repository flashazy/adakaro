-- Allow PostgREST / supabase-js with service_role to access subjects tables when
-- GRANT defaults differ (avoids "permission denied for table subjects").

GRANT ALL ON TABLE public.subjects TO service_role;
GRANT ALL ON TABLE public.subject_classes TO service_role;
