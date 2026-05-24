-- Audit action for failed admin password attempts on report card fee override.
ALTER TABLE public.report_card_fee_audit_log
  DROP CONSTRAINT IF EXISTS report_card_fee_audit_log_action_check;

ALTER TABLE public.report_card_fee_audit_log
  ADD CONSTRAINT report_card_fee_audit_log_action_check
  CHECK (
    action IN (
      'rule_created',
      'rule_changed',
      'rule_disabled',
      'admin_override_used',
      'admin_password_failed',
      'report_blocked'
    )
  );
