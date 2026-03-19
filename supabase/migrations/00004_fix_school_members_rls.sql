-- =============================================================
-- Fix school_members RLS so users can always SELECT their own rows.
--
-- The original policy only allowed reading rows via user_school_ids(),
-- which itself queries school_members — creating a circular dependency
-- that silently returns zero rows and makes the app think the user
-- has no school.
--
-- This script is idempotent: safe to run multiple times.
-- =============================================================

-- 1. Drop every known SELECT policy on school_members
drop policy if exists "Members can view members in their schools" on public.school_members;
drop policy if exists "Users can view own memberships" on public.school_members;
drop policy if exists "Members can view co-members in their schools" on public.school_members;

-- 2. Re-create the two correct SELECT policies
create policy "Users can view own memberships"
  on public.school_members for select
  using (user_id = auth.uid());

create policy "Members can view co-members in their schools"
  on public.school_members for select
  using (school_id in (select public.user_school_ids()));

-- 3. Ensure RLS is enabled (no-op if already on)
alter table public.school_members enable row level security;

-- 4. Ensure the authenticated role has SELECT + INSERT grants
grant select, insert, update, delete on public.school_members to authenticated;
