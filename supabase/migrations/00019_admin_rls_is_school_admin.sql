-- Extra RLS paths using is_school_admin() (SECURITY DEFINER) so admins can read
-- and manage school-scoped rows even when policies that only use user_school_ids()
-- fail (e.g. broken function variant or nested RLS on school_members).

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
drop policy if exists "Admins select classes via is_school_admin" on public.classes;
create policy "Admins select classes via is_school_admin"
  on public.classes for select
  using (public.is_school_admin(school_id));

-- ---------------------------------------------------------------------------
-- fee_types
-- ---------------------------------------------------------------------------
drop policy if exists "Admins select fee_types via is_school_admin" on public.fee_types;
create policy "Admins select fee_types via is_school_admin"
  on public.fee_types for select
  using (public.is_school_admin(school_id));

drop policy if exists "Admins insert fee_types via is_school_admin" on public.fee_types;
create policy "Admins insert fee_types via is_school_admin"
  on public.fee_types for insert
  with check (public.is_school_admin(school_id));

drop policy if exists "Admins update fee_types via is_school_admin" on public.fee_types;
create policy "Admins update fee_types via is_school_admin"
  on public.fee_types for update
  using (public.is_school_admin(school_id));

drop policy if exists "Admins delete fee_types via is_school_admin" on public.fee_types;
create policy "Admins delete fee_types via is_school_admin"
  on public.fee_types for delete
  using (public.is_school_admin(school_id));

-- ---------------------------------------------------------------------------
-- schools (dashboard header / reports)
-- ---------------------------------------------------------------------------
drop policy if exists "Admins select schools via is_school_admin" on public.schools;
create policy "Admins select schools via is_school_admin"
  on public.schools for select
  using (public.is_school_admin(id));

-- ---------------------------------------------------------------------------
-- parent_link_requests
-- ---------------------------------------------------------------------------
drop policy if exists "Admins select link requests via is_school_admin" on public.parent_link_requests;
create policy "Admins select link requests via is_school_admin"
  on public.parent_link_requests for select
  using (public.is_school_admin(school_id));

drop policy if exists "Admins update link requests via is_school_admin" on public.parent_link_requests;
create policy "Admins update link requests via is_school_admin"
  on public.parent_link_requests for update
  using (public.is_school_admin(school_id));

-- ---------------------------------------------------------------------------
-- parent_students (admin parent-links UI)
-- ---------------------------------------------------------------------------
drop policy if exists "Admins select parent_students via is_school_admin" on public.parent_students;
create policy "Admins select parent_students via is_school_admin"
  on public.parent_students for select
  using (
    exists (
      select 1 from public.students s
      where s.id = parent_students.student_id
        and public.is_school_admin(s.school_id)
    )
  );

drop policy if exists "Admins insert parent_students via is_school_admin" on public.parent_students;
create policy "Admins insert parent_students via is_school_admin"
  on public.parent_students for insert
  with check (
    exists (
      select 1 from public.students s
      where s.id = parent_students.student_id
        and public.is_school_admin(s.school_id)
    )
  );

drop policy if exists "Admins delete parent_students via is_school_admin" on public.parent_students;
create policy "Admins delete parent_students via is_school_admin"
  on public.parent_students for delete
  using (
    exists (
      select 1 from public.students s
      where s.id = parent_students.student_id
        and public.is_school_admin(s.school_id)
    )
  );
