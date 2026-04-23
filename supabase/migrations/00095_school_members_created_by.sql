-- Track which admin added each school_members row (for Team remove permissions).
-- School creator can remove any admin; other admins only if they created_by that membership.

ALTER TABLE public.school_members
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

COMMENT ON COLUMN public.school_members.created_by IS
  'Profile id of the admin who created this membership (school admin invite / promote / create-account). Nullable for legacy rows or teacher memberships.';

-- Existing admin memberships: attribute to the school owner (creator).
UPDATE public.school_members sm
SET created_by = s.created_by
FROM public.schools s
WHERE sm.school_id = s.id
  AND sm.role = 'admin'::public.user_role
  AND sm.created_by IS NULL
  AND s.created_by IS NOT NULL;
