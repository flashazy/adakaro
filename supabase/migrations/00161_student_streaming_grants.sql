-- Fix: 00160 enabled RLS but omitted table grants, causing
-- "permission denied for table student_streaming_history" (42501).

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.streaming_placement_rules
  TO authenticated;

GRANT SELECT, INSERT
  ON public.student_streaming_history
  TO authenticated;

GRANT ALL
  ON public.streaming_placement_rules
  TO service_role;

GRANT ALL
  ON public.student_streaming_history
  TO service_role;
