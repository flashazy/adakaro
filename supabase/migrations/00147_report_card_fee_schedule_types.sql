-- Flexible schedule modes for parent report card fee rules (simple, term, monthly).

ALTER TABLE public.report_card_fee_rules
  DROP CONSTRAINT IF EXISTS report_card_fee_rules_one_per_class;

ALTER TABLE public.report_card_fee_rules
  ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS term smallint,
  ADD COLUMN IF NOT EXISTS month smallint;

UPDATE public.report_card_fee_rules
SET schedule_type = 'simple'
WHERE schedule_type IS NULL OR schedule_type = '';

ALTER TABLE public.report_card_fee_rules
  DROP CONSTRAINT IF EXISTS report_card_fee_rules_schedule_type_check;

ALTER TABLE public.report_card_fee_rules
  ADD CONSTRAINT report_card_fee_rules_schedule_type_check CHECK (
    schedule_type IN ('simple', 'term_based', 'monthly_milestones')
  );

ALTER TABLE public.report_card_fee_rules
  DROP CONSTRAINT IF EXISTS report_card_fee_rules_term_check;

ALTER TABLE public.report_card_fee_rules
  ADD CONSTRAINT report_card_fee_rules_term_check CHECK (
    term IS NULL OR (term >= 1 AND term <= 3)
  );

ALTER TABLE public.report_card_fee_rules
  DROP CONSTRAINT IF EXISTS report_card_fee_rules_month_check;

ALTER TABLE public.report_card_fee_rules
  ADD CONSTRAINT report_card_fee_rules_month_check CHECK (
    month IS NULL OR (month >= 1 AND month <= 12)
  );

ALTER TABLE public.report_card_fee_rules
  DROP CONSTRAINT IF EXISTS report_card_fee_rules_schedule_fields_check;

ALTER TABLE public.report_card_fee_rules
  ADD CONSTRAINT report_card_fee_rules_schedule_fields_check CHECK (
    (
      schedule_type = 'simple'
      AND academic_year IS NULL
      AND term IS NULL
      AND month IS NULL
    )
    OR (
      schedule_type = 'term_based'
      AND academic_year IS NOT NULL
      AND term IS NOT NULL
      AND month IS NULL
    )
    OR (
      schedule_type = 'monthly_milestones'
      AND academic_year IS NOT NULL
      AND month IS NOT NULL
      AND term IS NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_card_fee_rules_simple_per_class
  ON public.report_card_fee_rules (school_id, class_id)
  WHERE schedule_type = 'simple';

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_card_fee_rules_term_per_class
  ON public.report_card_fee_rules (school_id, class_id, academic_year, term)
  WHERE schedule_type = 'term_based';

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_card_fee_rules_month_per_class
  ON public.report_card_fee_rules (school_id, class_id, academic_year, month)
  WHERE schedule_type = 'monthly_milestones';

CREATE INDEX IF NOT EXISTS idx_report_card_fee_rules_schedule
  ON public.report_card_fee_rules (class_id, schedule_type, academic_year);

COMMENT ON COLUMN public.report_card_fee_rules.schedule_type IS
  'simple = one class rule; term_based = per term; monthly_milestones = payment targets by month.';
