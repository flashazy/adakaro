-- Teacher onboarding: admin-provisioned accounts must change password on first login.
-- Existing users keep password_changed = true (no forced redirect).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_changed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.password_changed IS
  'When false (teacher only), user must change password before using the app. Set true after first password change.';

UPDATE public.profiles
SET password_changed = true
WHERE true;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role, password_changed)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'phone', ''),
    COALESCE((new.raw_user_meta_data ->> 'role')::public.user_role, 'parent'::public.user_role),
    COALESCE((new.raw_user_meta_data ->> 'password_changed')::boolean, true)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
