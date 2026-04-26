-- School finance/accounts: profile roles + optional Accounts department (same data access as Finance on student profile).

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'accounts';

-- Allow assigning teachers to "accounts" in addition to "finance" (UI maps both to the Finance tab).
ALTER TABLE public.teacher_department_roles
  DROP CONSTRAINT IF EXISTS teacher_department_roles_department_check;

ALTER TABLE public.teacher_department_roles
  ADD CONSTRAINT teacher_department_roles_department_check
  CHECK (
    department = ANY (
      ARRAY[
        'academic'::text,
        'discipline'::text,
        'health'::text,
        'finance'::text,
        'accounts'::text
      ]
    )
  );
