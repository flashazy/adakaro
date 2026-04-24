-- `password_forced_reset` is for teacher / parent recovery flows only, not school admins.
UPDATE public.profiles
SET password_forced_reset = false
WHERE role = 'admin';
