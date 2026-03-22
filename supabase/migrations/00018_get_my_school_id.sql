-- Dashboard could not "see" school_members after creation when SELECT policies
-- only allow rows via user_school_ids() (circular with school_members reads).
-- This RPC reads as definer and returns the current user's primary school_id.

create or replace function public.get_my_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sm.school_id
  from public.school_members sm
  where sm.user_id = auth.uid()
  order by sm.created_at asc
  limit 1;
$$;

comment on function public.get_my_school_id() is
  'Returns the first school_id for auth.uid(); bypasses RLS so the admin dashboard can load after founding a school.';

revoke all on function public.get_my_school_id() from public;
grant execute on function public.get_my_school_id() to authenticated;

-- Idempotent: always allow reading your own membership row (fixes circular RLS).
drop policy if exists "Users can view own memberships" on public.school_members;
create policy "Users can view own memberships"
  on public.school_members for select
  using (user_id = auth.uid());
