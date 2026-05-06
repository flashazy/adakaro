-- Service role needs explicit table privileges for admin scripts/actions.
-- Without this, PostgREST may return: "permission denied for table capture_card_users" (42501).

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.capture_card_users TO service_role;

