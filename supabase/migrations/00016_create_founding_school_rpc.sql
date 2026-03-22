-- Atomic school creation + founding admin membership (bypasses RLS safely).
-- Also ensures authenticated users can insert their first school_members row when not using RPC.

-- ---------------------------------------------------------------------------
-- school_members: allow user to insert own row (needed for direct inserts / legacy clients)
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can insert first membership" on public.school_members;
create policy "Authenticated users can insert first membership"
  on public.school_members for insert
  with check (auth.uid() = user_id);

grant insert on public.school_members to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create school + link caller as admin in one transaction
-- ---------------------------------------------------------------------------
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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Only users with an admin profile can create a school';
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
  'Creates a school and links the current user as admin. Caller must have profiles.role = admin and no existing school_members row.';

revoke all on function public.create_founding_school(text, text, text, text, text) from public;
grant execute on function public.create_founding_school(text, text, text, text, text) to authenticated;
