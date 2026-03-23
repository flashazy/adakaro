-- Server-side invite fallback uses service_role; 00032 only granted SELECT.
-- Without INSERT, createAdminClient() cannot insert pending admin invitations.

GRANT INSERT, UPDATE, DELETE ON TABLE public.school_invitations TO service_role;
