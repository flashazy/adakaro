-- One-time: grant platform super admin to your account.
-- Replace the email, then run in Supabase SQL Editor (or psql).

UPDATE public.profiles
SET role = 'super_admin'::public.user_role,
    updated_at = now()
WHERE lower(trim(email)) = lower(trim('your-email@example.com'));

-- Verify:
-- SELECT id, email, role FROM public.profiles WHERE role = 'super_admin'::public.user_role;
