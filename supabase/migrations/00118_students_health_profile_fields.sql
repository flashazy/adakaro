-- Student profile health fields (date_of_birth exists in baseline schema; IF NOT EXISTS keeps replays safe).
alter table public.students
  add column if not exists date_of_birth date;

alter table public.students
  add column if not exists allergies text;

alter table public.students
  add column if not exists disability text;

alter table public.students
  add column if not exists insurance_provider varchar(255);

alter table public.students
  add column if not exists insurance_policy varchar(255);
