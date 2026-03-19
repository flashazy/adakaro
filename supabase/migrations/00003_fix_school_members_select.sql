-- Fix: allow users to always read their own school_members rows.
-- The previous policy used user_school_ids() which creates a circular
-- dependency for the first SELECT.

drop policy if exists "Members can view members in their schools" on public.school_members;

create policy "Users can view own memberships"
  on public.school_members for select
  using (user_id = auth.uid());

create policy "Members can view co-members in their schools"
  on public.school_members for select
  using (school_id in (select public.user_school_ids()));
