-- =============================================================
-- fee_types table — simple catalogue of fee categories
-- =============================================================

create table if not exists public.fee_types (
  id           uuid        primary key default gen_random_uuid(),
  school_id    uuid        not null references public.schools(id) on delete cascade,
  name         text        not null,
  description  text,
  is_recurring boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists idx_fee_types_school on public.fee_types(school_id);

drop trigger if exists fee_types_updated_at on public.fee_types;
create trigger fee_types_updated_at
  before update on public.fee_types
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.fee_types enable row level security;

drop policy if exists "Members can view fee types" on public.fee_types;
drop policy if exists "Admins can create fee types" on public.fee_types;
drop policy if exists "Admins can update fee types" on public.fee_types;
drop policy if exists "Admins can delete fee types" on public.fee_types;

create policy "Members can view fee types"
  on public.fee_types for select
  using (school_id in (select public.user_school_ids()));

create policy "Admins can create fee types"
  on public.fee_types for insert
  with check (school_id in (select public.user_school_ids()));

create policy "Admins can update fee types"
  on public.fee_types for update
  using (school_id in (select public.user_school_ids()));

create policy "Admins can delete fee types"
  on public.fee_types for delete
  using (school_id in (select public.user_school_ids()));

grant select, insert, update, delete on public.fee_types to authenticated;
