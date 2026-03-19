-- ============================================================
-- Adakaro — Safe setup (skips existing objects)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ---------- ENUM TYPES (skip if they exist) ----------
do $$ begin create type user_role as enum ('admin', 'parent'); exception when duplicate_object then null; end $$;
do $$ begin create type student_status as enum ('active', 'inactive', 'graduated', 'transferred'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_method as enum ('cash', 'bank_transfer', 'mobile_money', 'card', 'cheque'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_status as enum ('completed', 'pending', 'failed', 'refunded'); exception when duplicate_object then null; end $$;

-- ---------- HELPER FUNCTION ----------
create or replace function public.handle_updated_at()
returns trigger language plpgsql security definer as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------- PROFILES (skip if exists) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text    not null default '',
  email      text,
  phone      text,
  role       user_role not null default 'parent',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Profile trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'parent')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- SCHOOLS (skip if exists) ----------
create table if not exists public.schools (
  id         uuid primary key default gen_random_uuid(),
  name       text    not null,
  address    text,
  phone      text,
  email      text,
  logo_url   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists schools_updated_at on public.schools;
create trigger schools_updated_at before update on public.schools
  for each row execute function public.handle_updated_at();

-- ---------- SCHOOL_MEMBERS ----------
create table if not exists public.school_members (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid      not null references public.schools(id) on delete cascade,
  user_id    uuid      not null references public.profiles(id) on delete cascade,
  role       user_role not null default 'parent',
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);
create index if not exists idx_school_members_user   on public.school_members(user_id);
create index if not exists idx_school_members_school on public.school_members(school_id);

-- ---------- CLASSES ----------
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (school_id, name)
);
create index if not exists idx_classes_school on public.classes(school_id);
drop trigger if exists classes_updated_at on public.classes;
create trigger classes_updated_at before update on public.classes
  for each row execute function public.handle_updated_at();

-- ---------- STUDENTS ----------
create table if not exists public.students (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid           not null references public.schools(id)   on delete cascade,
  class_id         uuid           not null references public.classes(id)   on delete restrict,
  parent_id        uuid           not null references public.profiles(id)  on delete restrict,
  full_name        text           not null,
  admission_number text,
  date_of_birth    date,
  gender           text           check (gender in ('male', 'female', 'other')),
  status           student_status not null default 'active',
  created_at       timestamptz    not null default now(),
  updated_at       timestamptz    not null default now(),
  unique (school_id, admission_number)
);
create index if not exists idx_students_school on public.students(school_id);
create index if not exists idx_students_class  on public.students(class_id);
create index if not exists idx_students_parent on public.students(parent_id);
drop trigger if exists students_updated_at on public.students;
create trigger students_updated_at before update on public.students
  for each row execute function public.handle_updated_at();

-- ---------- FEE_STRUCTURES ----------
create table if not exists public.fee_structures (
  id          uuid           primary key default gen_random_uuid(),
  school_id   uuid           not null references public.schools(id) on delete cascade,
  class_id    uuid           references public.classes(id) on delete cascade,
  name        text           not null,
  amount      numeric(12, 2) not null check (amount > 0),
  term        text           not null,
  due_date    date,
  description text,
  is_active   boolean        not null default true,
  created_at  timestamptz    not null default now(),
  updated_at  timestamptz    not null default now()
);
create index if not exists idx_fee_structures_school on public.fee_structures(school_id);
create index if not exists idx_fee_structures_class  on public.fee_structures(class_id);
drop trigger if exists fee_structures_updated_at on public.fee_structures;
create trigger fee_structures_updated_at before update on public.fee_structures
  for each row execute function public.handle_updated_at();

-- ---------- PAYMENTS ----------
create table if not exists public.payments (
  id               uuid           primary key default gen_random_uuid(),
  student_id       uuid           not null references public.students(id)       on delete restrict,
  fee_structure_id uuid           not null references public.fee_structures(id) on delete restrict,
  amount           numeric(12, 2) not null check (amount > 0),
  method           payment_method not null,
  status           payment_status not null default 'completed',
  payment_date     date           not null default current_date,
  reference        text,
  recorded_by      uuid           not null references public.profiles(id),
  notes            text,
  created_at       timestamptz    not null default now(),
  updated_at       timestamptz    not null default now()
);
create index if not exists idx_payments_student       on public.payments(student_id);
create index if not exists idx_payments_fee_structure on public.payments(fee_structure_id);
create index if not exists idx_payments_recorded_by   on public.payments(recorded_by);
drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at before update on public.payments
  for each row execute function public.handle_updated_at();

-- ---------- RECEIPTS ----------
create table if not exists public.receipts (
  id             uuid        primary key default gen_random_uuid(),
  payment_id     uuid        not null references public.payments(id) on delete restrict,
  receipt_number text        not null unique,
  issued_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_receipts_payment on public.receipts(payment_id);
drop trigger if exists receipts_updated_at on public.receipts;
create trigger receipts_updated_at before update on public.receipts
  for each row execute function public.handle_updated_at();

create sequence if not exists public.receipt_seq;
create or replace function public.generate_receipt_number()
returns trigger language plpgsql security definer as $$
begin
  new.receipt_number := 'RCP-' || to_char(now(), 'YYYYMMDD') || '-' ||
                        lpad(nextval('public.receipt_seq')::text, 5, '0');
  return new;
end; $$;
drop trigger if exists receipts_generate_number on public.receipts;
create trigger receipts_generate_number before insert on public.receipts
  for each row when (new.receipt_number is null or new.receipt_number = '')
  execute function public.generate_receipt_number();

-- ============================================================
-- RLS HELPER FUNCTIONS
-- ============================================================
create or replace function public.get_school_role(p_school_id uuid)
returns user_role language sql stable security definer set search_path = '' as $$
  select role from public.school_members where school_id = p_school_id and user_id = auth.uid() limit 1;
$$;

create or replace function public.is_school_admin(p_school_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.school_members where school_id = p_school_id and user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.user_school_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select school_id from public.school_members where user_id = auth.uid();
$$;

create or replace function public.parent_student_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.students where parent_id = auth.uid();
$$;

-- ============================================================
-- ROW LEVEL SECURITY + POLICIES
-- ============================================================
alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.fee_structures enable row level security;
alter table public.payments enable row level security;
alter table public.receipts enable row level security;

-- Drop existing policies to avoid conflicts, then recreate
do $$ declare r record;
begin
  for r in (select policyname, tablename from pg_policies where schemaname = 'public') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- PROFILES
create policy "Users can read own profile" on public.profiles for select using (id = auth.uid());
create policy "Admins can read profiles in their schools" on public.profiles for select
  using (id in (select sm.user_id from public.school_members sm where sm.school_id in (select public.user_school_ids())));
create policy "Users can update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- SCHOOLS
create policy "Members can view their schools" on public.schools for select using (id in (select public.user_school_ids()));
create policy "Authenticated users can create schools" on public.schools for insert with check (auth.uid() is not null);
create policy "Admins can update their school" on public.schools for update using (public.is_school_admin(id)) with check (public.is_school_admin(id));
create policy "Admins can delete their school" on public.schools for delete using (public.is_school_admin(id));

-- SCHOOL_MEMBERS
create policy "Members can view members in their schools" on public.school_members for select using (school_id in (select public.user_school_ids()) or user_id = auth.uid());
create policy "Authenticated users can insert first membership" on public.school_members for insert with check (auth.uid() = user_id);
create policy "Admins can update members" on public.school_members for update using (public.is_school_admin(school_id));
create policy "Admins can remove members" on public.school_members for delete using (public.is_school_admin(school_id));

-- CLASSES
create policy "Members can view classes" on public.classes for select using (school_id in (select public.user_school_ids()));
create policy "Admins can create classes" on public.classes for insert with check (public.is_school_admin(school_id));
create policy "Admins can update classes" on public.classes for update using (public.is_school_admin(school_id));
create policy "Admins can delete classes" on public.classes for delete using (public.is_school_admin(school_id));

-- STUDENTS
create policy "Admins can view students" on public.students for select using (public.is_school_admin(school_id));
create policy "Parents can view own children" on public.students for select using (parent_id = auth.uid());
create policy "Admins can create students" on public.students for insert with check (public.is_school_admin(school_id));
create policy "Admins can update students" on public.students for update using (public.is_school_admin(school_id));
create policy "Admins can delete students" on public.students for delete using (public.is_school_admin(school_id));

-- FEE_STRUCTURES
create policy "Admins can view fee structures" on public.fee_structures for select using (public.is_school_admin(school_id));
create policy "Parents can view fee structures" on public.fee_structures for select
  using (school_id in (select s.school_id from public.students s where s.parent_id = auth.uid()));
create policy "Admins can create fee structures" on public.fee_structures for insert with check (public.is_school_admin(school_id));
create policy "Admins can update fee structures" on public.fee_structures for update using (public.is_school_admin(school_id));
create policy "Admins can delete fee structures" on public.fee_structures for delete using (public.is_school_admin(school_id));

-- PAYMENTS
create policy "Admins can view payments" on public.payments for select
  using (student_id in (select s.id from public.students s where public.is_school_admin(s.school_id)));
create policy "Parents can view payments" on public.payments for select
  using (student_id in (select public.parent_student_ids()));
create policy "Admins can record payments" on public.payments for insert
  with check (auth.uid() = recorded_by and student_id in (select s.id from public.students s where public.is_school_admin(s.school_id)));
create policy "Admins can update payments" on public.payments for update
  using (student_id in (select s.id from public.students s where public.is_school_admin(s.school_id)));
create policy "Admins can delete payments" on public.payments for delete
  using (student_id in (select s.id from public.students s where public.is_school_admin(s.school_id)));

-- RECEIPTS
create policy "Admins can view receipts" on public.receipts for select
  using (payment_id in (select p.id from public.payments p join public.students s on s.id = p.student_id where public.is_school_admin(s.school_id)));
create policy "Parents can view receipts" on public.receipts for select
  using (payment_id in (select p.id from public.payments p where p.student_id in (select public.parent_student_ids())));
create policy "Admins can create receipts" on public.receipts for insert
  with check (payment_id in (select p.id from public.payments p join public.students s on s.id = p.student_id where public.is_school_admin(s.school_id)));

-- ============================================================
-- GRANTS
-- ============================================================
grant usage on schema public to authenticated, anon;
grant all on public.profiles to authenticated;
grant all on public.schools to authenticated;
grant all on public.school_members to authenticated;
grant all on public.classes to authenticated;
grant all on public.students to authenticated;
grant all on public.fee_structures to authenticated;
grant all on public.payments to authenticated;
grant all on public.receipts to authenticated;
grant usage, select on sequence public.receipt_seq to authenticated;
grant select on public.profiles to anon;
