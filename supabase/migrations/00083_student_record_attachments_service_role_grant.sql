-- Restore service_role grants on student_record_attachments + related tables.
--
-- Symptom: server-side reads via the Supabase admin client (service_role JWT)
-- failed with "permission denied for table student_record_attachments". This
-- happens when the table-level GRANTs from migration 00081 were not applied
-- (e.g. partial migration, manual revoke, or out-of-order apply).
--
-- These grants are idempotent and safe to re-run on any environment.

GRANT ALL ON public.student_record_attachments TO service_role;
GRANT ALL ON public.school_member_record_attachment_scopes TO service_role;

-- Also (re)grant on the four student profile record tables, so admin-client
-- reads driven by teacher_department_roles never hit a similar permission gap.
GRANT ALL ON public.student_academic_records TO service_role;
GRANT ALL ON public.student_discipline_records TO service_role;
GRANT ALL ON public.student_health_records TO service_role;
GRANT ALL ON public.student_finance_records TO service_role;
