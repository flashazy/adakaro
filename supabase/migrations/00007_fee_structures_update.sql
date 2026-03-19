-- =============================================================
-- Update fee_structures to link to fee_types and allow
-- targeting individual students as well as classes.
-- =============================================================

-- Add new columns (safe: does nothing if they already exist)
alter table public.fee_structures
  add column if not exists fee_type_id uuid references public.fee_types(id) on delete restrict,
  add column if not exists student_id  uuid references public.students(id) on delete cascade;

create index if not exists idx_fee_structures_fee_type on public.fee_structures(fee_type_id);
create index if not exists idx_fee_structures_student on public.fee_structures(student_id);

-- RLS (drop + recreate to be idempotent)
alter table public.fee_structures enable row level security;

drop policy if exists "Admins can view fee structures" on public.fee_structures;
drop policy if exists "Parents can view fee structures" on public.fee_structures;
drop policy if exists "Members can view fee structures" on public.fee_structures;
drop policy if exists "Admins can create fee structures" on public.fee_structures;
drop policy if exists "Admins can update fee structures" on public.fee_structures;
drop policy if exists "Admins can delete fee structures" on public.fee_structures;

create policy "Members can view fee structures"
  on public.fee_structures for select
  using (school_id in (select public.user_school_ids()));

create policy "Admins can create fee structures"
  on public.fee_structures for insert
  with check (school_id in (select public.user_school_ids()));

create policy "Admins can update fee structures"
  on public.fee_structures for update
  using (school_id in (select public.user_school_ids()));

create policy "Admins can delete fee structures"
  on public.fee_structures for delete
  using (school_id in (select public.user_school_ids()));

grant select, insert, update, delete on public.fee_structures to authenticated;
