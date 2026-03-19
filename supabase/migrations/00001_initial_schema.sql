-- ============================================================
-- Adakaro — School Fee Management
-- Initial database schema
-- ============================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "pgcrypto";

-- ---------- CUSTOM ENUM TYPES ----------
create type user_role    as enum ('admin', 'parent');
create type student_status as enum ('active', 'inactive', 'graduated', 'transferred');
create type payment_method as enum ('cash', 'bank_transfer', 'mobile_money', 'card', 'cheque');
create type payment_status as enum ('completed', 'pending', 'failed', 'refunded');

-- ---------- HELPER: auto-update updated_at ----------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1. PROFILES  (extends auth.users)
-- ============================================================
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text    not null,
  email      text,
  phone      text,
  role       user_role not null default 'parent',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create profile on sign-up (reads full_name, role, phone from metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'parent')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. SCHOOLS
-- ============================================================
create table public.schools (
  id         uuid primary key default gen_random_uuid(),
  name       text    not null,
  address    text,
  phone      text,
  email      text,
  logo_url   text,
  created_by uuid    not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_schools_created_by on public.schools(created_by);

create trigger schools_updated_at
  before update on public.schools
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 3. SCHOOL_MEMBERS  (links users ↔ schools with a role)
-- ============================================================
create table public.school_members (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid      not null references public.schools(id) on delete cascade,
  user_id    uuid      not null references public.profiles(id) on delete cascade,
  role       user_role not null default 'parent',
  created_at timestamptz not null default now(),

  unique (school_id, user_id)
);

create index idx_school_members_user    on public.school_members(user_id);
create index idx_school_members_school  on public.school_members(school_id);

-- ============================================================
-- 4. CLASSES
-- ============================================================
create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (school_id, name)
);

create index idx_classes_school on public.classes(school_id);

create trigger classes_updated_at
  before update on public.classes
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 5. STUDENTS
-- ============================================================
create table public.students (
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

create index idx_students_school  on public.students(school_id);
create index idx_students_class   on public.students(class_id);
create index idx_students_parent  on public.students(parent_id);
create index idx_students_status  on public.students(status);

create trigger students_updated_at
  before update on public.students
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 6. FEE_STRUCTURES
-- ============================================================
create table public.fee_structures (
  id          uuid           primary key default gen_random_uuid(),
  school_id   uuid           not null references public.schools(id)  on delete cascade,
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

comment on column public.fee_structures.class_id is
  'NULL means the fee applies to all classes in the school.';

create index idx_fee_structures_school on public.fee_structures(school_id);
create index idx_fee_structures_class  on public.fee_structures(class_id);

create trigger fee_structures_updated_at
  before update on public.fee_structures
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 7. PAYMENTS
-- ============================================================
create table public.payments (
  id               uuid           primary key default gen_random_uuid(),
  student_id       uuid           not null references public.students(id)        on delete restrict,
  fee_structure_id uuid           not null references public.fee_structures(id)  on delete restrict,
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

create index idx_payments_student       on public.payments(student_id);
create index idx_payments_fee_structure on public.payments(fee_structure_id);
create index idx_payments_recorded_by   on public.payments(recorded_by);
create index idx_payments_date          on public.payments(payment_date);
create index idx_payments_status        on public.payments(status);

create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 8. RECEIPTS
-- ============================================================
create table public.receipts (
  id             uuid        primary key default gen_random_uuid(),
  payment_id     uuid        not null references public.payments(id) on delete restrict,
  receipt_number text        not null unique,
  issued_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_receipts_payment on public.receipts(payment_id);

create trigger receipts_updated_at
  before update on public.receipts
  for each row execute function public.handle_updated_at();

-- Auto-generate receipt number  (RCP-YYYYMMDD-XXXXX)
create sequence public.receipt_seq;

create or replace function public.generate_receipt_number()
returns trigger
language plpgsql
security definer
as $$
begin
  new.receipt_number := 'RCP-' || to_char(now(), 'YYYYMMDD') || '-' ||
                        lpad(nextval('public.receipt_seq')::text, 5, '0');
  return new;
end;
$$;

create trigger receipts_generate_number
  before insert on public.receipts
  for each row
  when (new.receipt_number is null or new.receipt_number = '')
  execute function public.generate_receipt_number();

-- ============================================================
-- VIEW: student_fee_balances
-- Outstanding balance per student per fee structure
-- ============================================================
create or replace view public.student_fee_balances as
select
  s.id          as student_id,
  s.full_name   as student_name,
  s.school_id,
  s.class_id,
  s.parent_id,
  fs.id         as fee_structure_id,
  fs.name       as fee_name,
  fs.term,
  fs.amount     as total_fee,
  coalesce(sum(p.amount) filter (where p.status = 'completed'), 0) as total_paid,
  fs.amount - coalesce(sum(p.amount) filter (where p.status = 'completed'), 0) as balance,
  fs.due_date
from public.students s
cross join public.fee_structures fs
left join public.payments p
  on p.student_id = s.id
  and p.fee_structure_id = fs.id
where fs.is_active = true
  and s.status = 'active'
  and (fs.class_id = s.class_id or fs.class_id is null)
  and fs.school_id = s.school_id
group by s.id, s.full_name, s.school_id, s.class_id, s.parent_id,
         fs.id, fs.name, fs.term, fs.amount, fs.due_date;

-- ============================================================
-- RLS HELPER FUNCTIONS
-- ============================================================

-- Current user's role in a given school
create or replace function public.get_school_role(p_school_id uuid)
returns user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.school_members
  where school_id = p_school_id
    and user_id = auth.uid()
  limit 1;
$$;

-- Is the current user an admin in this school?
create or replace function public.is_school_admin(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.school_members
    where school_id = p_school_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- All school IDs where the current user is a member
create or replace function public.user_school_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select school_id from public.school_members
  where user_id = auth.uid();
$$;

-- All student IDs belonging to the current parent
create or replace function public.parent_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.students
  where parent_id = auth.uid();
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- -------- PROFILES --------
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Admins can read profiles in their schools"
  on public.profiles for select
  using (
    id in (
      select sm.user_id from public.school_members sm
      where sm.school_id in (select public.user_school_ids())
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- -------- SCHOOLS --------
alter table public.schools enable row level security;

create policy "Members can view their schools"
  on public.schools for select
  using (id in (select public.user_school_ids()));

create policy "Authenticated users can create schools"
  on public.schools for insert
  with check (auth.uid() = created_by);

create policy "Admins can update their school"
  on public.schools for update
  using (public.is_school_admin(id))
  with check (public.is_school_admin(id));

create policy "Admins can delete their school"
  on public.schools for delete
  using (public.is_school_admin(id));

-- -------- SCHOOL_MEMBERS --------
alter table public.school_members enable row level security;

create policy "Members can view members in their schools"
  on public.school_members for select
  using (school_id in (select public.user_school_ids()));

create policy "Admins can insert members"
  on public.school_members for insert
  with check (public.is_school_admin(school_id));

create policy "Admins can update members"
  on public.school_members for update
  using (public.is_school_admin(school_id))
  with check (public.is_school_admin(school_id));

create policy "Admins can remove members"
  on public.school_members for delete
  using (public.is_school_admin(school_id));

-- -------- CLASSES --------
alter table public.classes enable row level security;

create policy "Members can view classes in their schools"
  on public.classes for select
  using (school_id in (select public.user_school_ids()));

create policy "Admins can create classes"
  on public.classes for insert
  with check (public.is_school_admin(school_id));

create policy "Admins can update classes"
  on public.classes for update
  using (public.is_school_admin(school_id))
  with check (public.is_school_admin(school_id));

create policy "Admins can delete classes"
  on public.classes for delete
  using (public.is_school_admin(school_id));

-- -------- STUDENTS --------
alter table public.students enable row level security;

create policy "Admins can view students in their schools"
  on public.students for select
  using (public.is_school_admin(school_id));

create policy "Parents can view their own children"
  on public.students for select
  using (parent_id = auth.uid());

create policy "Admins can create students"
  on public.students for insert
  with check (public.is_school_admin(school_id));

create policy "Admins can update students"
  on public.students for update
  using (public.is_school_admin(school_id))
  with check (public.is_school_admin(school_id));

create policy "Admins can delete students"
  on public.students for delete
  using (public.is_school_admin(school_id));

-- -------- FEE_STRUCTURES --------
alter table public.fee_structures enable row level security;

create policy "Admins can view fee structures"
  on public.fee_structures for select
  using (public.is_school_admin(school_id));

create policy "Parents can view fee structures for their children's school"
  on public.fee_structures for select
  using (school_id in (
    select s.school_id from public.students s
    where s.parent_id = auth.uid()
  ));

create policy "Admins can create fee structures"
  on public.fee_structures for insert
  with check (public.is_school_admin(school_id));

create policy "Admins can update fee structures"
  on public.fee_structures for update
  using (public.is_school_admin(school_id))
  with check (public.is_school_admin(school_id));

create policy "Admins can delete fee structures"
  on public.fee_structures for delete
  using (public.is_school_admin(school_id));

-- -------- PAYMENTS --------
alter table public.payments enable row level security;

create policy "Admins can view payments in their schools"
  on public.payments for select
  using (
    student_id in (
      select s.id from public.students s
      where public.is_school_admin(s.school_id)
    )
  );

create policy "Parents can view their children's payments"
  on public.payments for select
  using (student_id in (select public.parent_student_ids()));

create policy "Admins can record payments"
  on public.payments for insert
  with check (
    auth.uid() = recorded_by
    and student_id in (
      select s.id from public.students s
      where public.is_school_admin(s.school_id)
    )
  );

create policy "Admins can update payments"
  on public.payments for update
  using (
    student_id in (
      select s.id from public.students s
      where public.is_school_admin(s.school_id)
    )
  );

create policy "Admins can delete payments"
  on public.payments for delete
  using (
    student_id in (
      select s.id from public.students s
      where public.is_school_admin(s.school_id)
    )
  );

-- -------- RECEIPTS --------
alter table public.receipts enable row level security;

create policy "Admins can view receipts in their schools"
  on public.receipts for select
  using (
    payment_id in (
      select p.id from public.payments p
      join public.students s on s.id = p.student_id
      where public.is_school_admin(s.school_id)
    )
  );

create policy "Parents can view their children's receipts"
  on public.receipts for select
  using (
    payment_id in (
      select p.id from public.payments p
      where p.student_id in (select public.parent_student_ids())
    )
  );

create policy "Admins can create receipts"
  on public.receipts for insert
  with check (
    payment_id in (
      select p.id from public.payments p
      join public.students s on s.id = p.student_id
      where public.is_school_admin(s.school_id)
    )
  );

create policy "Admins can update receipts"
  on public.receipts for update
  using (
    payment_id in (
      select p.id from public.payments p
      join public.students s on s.id = p.student_id
      where public.is_school_admin(s.school_id)
    )
  );

-- ============================================================
-- SEED: auto-add school creator as admin member
-- ============================================================
create or replace function public.handle_new_school()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.school_members (school_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

create trigger on_school_created
  after insert on public.schools
  for each row execute function public.handle_new_school();
