-- =============================================================
-- Ensure payments and receipts RLS allows admin operations.
-- Uses user_school_ids() to keep things simple and avoid
-- complex joins in policies.
-- =============================================================

-- PAYMENTS
alter table public.payments enable row level security;

drop policy if exists "Admins can view payments" on public.payments;
drop policy if exists "Parents can view payments" on public.payments;
drop policy if exists "Admins can record payments" on public.payments;
drop policy if exists "Admins can update payments" on public.payments;
drop policy if exists "Admins can delete payments" on public.payments;

create policy "Admins can view payments" on public.payments for select
  using (student_id in (
    select id from public.students where school_id in (select public.user_school_ids())
  ));

create policy "Admins can record payments" on public.payments for insert
  with check (student_id in (
    select id from public.students where school_id in (select public.user_school_ids())
  ));

create policy "Admins can update payments" on public.payments for update
  using (student_id in (
    select id from public.students where school_id in (select public.user_school_ids())
  ));

create policy "Admins can delete payments" on public.payments for delete
  using (student_id in (
    select id from public.students where school_id in (select public.user_school_ids())
  ));

grant select, insert, update, delete on public.payments to authenticated;

-- RECEIPTS
alter table public.receipts enable row level security;

drop policy if exists "Admins can view receipts" on public.receipts;
drop policy if exists "Parents can view receipts" on public.receipts;
drop policy if exists "Admins can create receipts" on public.receipts;

create policy "Admins can view receipts" on public.receipts for select
  using (payment_id in (
    select id from public.payments where student_id in (
      select id from public.students where school_id in (select public.user_school_ids())
    )
  ));

create policy "Admins can create receipts" on public.receipts for insert
  with check (payment_id in (
    select id from public.payments where student_id in (
      select id from public.students where school_id in (select public.user_school_ids())
    )
  ));

grant select, insert on public.receipts to authenticated;
grant usage, select on sequence public.receipt_seq to authenticated;
