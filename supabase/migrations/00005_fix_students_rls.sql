-- =============================================================
-- Fix students RLS so admins can SELECT students in their school.
--
-- Drops any existing SELECT policies that might reference
-- non-existent columns (parent_id) and recreates clean ones.
-- =============================================================

-- Ensure RLS is on
alter table public.students enable row level security;

-- Drop any existing SELECT policies
drop policy if exists "Admins can view students" on public.students;
drop policy if exists "Parents can view own children" on public.students;
drop policy if exists "Admins can view students in their schools" on public.students;
drop policy if exists "Members can view students" on public.students;

-- Admins can view all students in their school
create policy "Admins can view students"
  on public.students for select
  using (school_id in (select public.user_school_ids()));

-- Drop and recreate INSERT/UPDATE/DELETE policies too
drop policy if exists "Admins can create students" on public.students;
drop policy if exists "Admins can update students" on public.students;
drop policy if exists "Admins can delete students" on public.students;

create policy "Admins can create students"
  on public.students for insert
  with check (school_id in (select public.user_school_ids()));

create policy "Admins can update students"
  on public.students for update
  using (school_id in (select public.user_school_ids()));

create policy "Admins can delete students"
  on public.students for delete
  using (school_id in (select public.user_school_ids()));

-- Ensure grants
grant select, insert, update, delete on public.students to authenticated;
