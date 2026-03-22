-- Allow founding school when profiles.role = 'admin' OR JWT user_metadata.role = 'admin'
-- (fixes users who are admin in Auth metadata but profile row is missing/wrong)

create or replace function public.create_founding_school(
  p_name text,
  p_address text default null,
  p_phone text default null,
  p_email text default null,
  p_logo_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_jwt_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_jwt_role := lower(trim(coalesce(
    (select auth.jwt())->'user_metadata'->>'role',
    ''
  )));

  if not (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
    or v_jwt_role = 'admin'
  ) then
    raise exception 'Only school admins can create a school. Set profiles.role to admin for your user, or ensure signup stored role admin in user metadata.';
  end if;

  if exists (
    select 1 from public.school_members sm where sm.user_id = auth.uid()
  ) then
    raise exception 'You already belong to a school';
  end if;

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'School name is required';
  end if;

  insert into public.schools (name, address, phone, email, logo_url, created_by)
  values (
    trim(p_name),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    p_logo_url,
    auth.uid()
  )
  returning id into v_school_id;

  insert into public.school_members (school_id, user_id, role)
  values (v_school_id, auth.uid(), 'admin');

  return v_school_id;
end;
$$;

comment on function public.create_founding_school(text, text, text, text, text) is
  'Creates a school and links the current user as admin. Caller must be admin in profiles.role or JWT user_metadata.role, and have no school_members row.';

revoke all on function public.create_founding_school(text, text, text, text, text) from public;
grant execute on function public.create_founding_school(text, text, text, text, text) to authenticated;

-- Manual fix for a specific admin (run in SQL editor if needed):
-- update public.profiles set role = 'admin', updated_at = now()
-- where id = (select id from auth.users where email = 'abdahomy@gmail.com' limit 1);
