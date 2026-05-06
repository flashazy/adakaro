-- Allow service_role to INSERT profiles when upserting after Auth admin.createUser
-- (capture_card_user provisioning). UPDATE was already granted in 00035.

GRANT INSERT ON TABLE public.profiles TO service_role;
