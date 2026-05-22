-- Finance-controlled parent report card access (rules + audit).

CREATE TABLE IF NOT EXISTS public.report_card_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN ('percentage', 'fixed_amount')),
  required_percentage numeric(5, 2),
  required_amount numeric(12, 2),
  is_enabled boolean NOT NULL DEFAULT false,
  allow_admin_override boolean NOT NULL DEFAULT true,
  message_to_parent text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_card_fee_rules_one_per_class UNIQUE (class_id),
  CONSTRAINT report_card_fee_rules_type_fields CHECK (
    (
      rule_type = 'percentage'
      AND required_percentage IS NOT NULL
      AND required_percentage >= 0
      AND required_percentage <= 100
      AND required_amount IS NULL
    )
    OR (
      rule_type = 'fixed_amount'
      AND required_amount IS NOT NULL
      AND required_amount >= 0
      AND required_percentage IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_report_card_fee_rules_school
  ON public.report_card_fee_rules(school_id);

CREATE INDEX IF NOT EXISTS idx_report_card_fee_rules_class
  ON public.report_card_fee_rules(class_id);

DROP TRIGGER IF EXISTS report_card_fee_rules_updated_at ON public.report_card_fee_rules;
CREATE TRIGGER report_card_fee_rules_updated_at
  BEFORE UPDATE ON public.report_card_fee_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.report_card_fee_rules IS
  'Per-class fee completion rules gating parent report card access only.';

-- Audit trail for rule changes, blocks, and admin overrides.
CREATE TABLE IF NOT EXISTS public.report_card_fee_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN (
      'rule_created',
      'rule_changed',
      'rule_disabled',
      'admin_override_used',
      'report_blocked'
    )
  ),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_card_fee_audit_school
  ON public.report_card_fee_audit_log(school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_card_fee_audit_student
  ON public.report_card_fee_audit_log(student_id, created_at DESC);

-- Finance / school admin manage rules; members of school may read.
ALTER TABLE public.report_card_fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_card_fee_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members view report card fee rules"
  ON public.report_card_fee_rules;
CREATE POLICY "School members view report card fee rules"
  ON public.report_card_fee_rules FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

DROP POLICY IF EXISTS "Finance and admins manage report card fee rules"
  ON public.report_card_fee_rules;
CREATE POLICY "Finance and admins manage report card fee rules"
  ON public.report_card_fee_rules FOR ALL
  USING (
    school_id IN (SELECT public.user_school_ids())
    AND (
      public.is_school_admin(school_id)
      OR EXISTS (
        SELECT 1
        FROM public.teacher_department_roles tdr
        WHERE tdr.school_id = report_card_fee_rules.school_id
          AND tdr.user_id = auth.uid()
          AND tdr.department IN ('finance', 'accounts')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('finance', 'accounts')
      )
    )
  )
  WITH CHECK (
    school_id IN (SELECT public.user_school_ids())
    AND (
      public.is_school_admin(school_id)
      OR EXISTS (
        SELECT 1
        FROM public.teacher_department_roles tdr
        WHERE tdr.school_id = report_card_fee_rules.school_id
          AND tdr.user_id = auth.uid()
          AND tdr.department IN ('finance', 'accounts')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('finance', 'accounts')
      )
    )
  );

DROP POLICY IF EXISTS "School members view report card fee audit"
  ON public.report_card_fee_audit_log;
CREATE POLICY "School members view report card fee audit"
  ON public.report_card_fee_audit_log FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

DROP POLICY IF EXISTS "Authenticated insert report card fee audit"
  ON public.report_card_fee_audit_log;
CREATE POLICY "Authenticated insert report card fee audit"
  ON public.report_card_fee_audit_log FOR INSERT
  WITH CHECK (
    school_id IN (SELECT public.user_school_ids())
    AND performed_by = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_card_fee_rules TO authenticated;
GRANT SELECT, INSERT ON public.report_card_fee_audit_log TO authenticated;
