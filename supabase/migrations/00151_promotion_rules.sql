-- Phase 2: Grade-based promotion rules (Tanzania — average exam grade only)

-- ---------------------------------------------------------------------------
-- promotion_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promotion_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  min_average_grade numeric(5, 2) NOT NULL CHECK (min_average_grade >= 0 AND min_average_grade <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS promotion_rules_school_default_unique
  ON public.promotion_rules (school_id)
  WHERE class_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS promotion_rules_per_class_unique
  ON public.promotion_rules (school_id, class_id)
  WHERE class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promotion_rules_school
  ON public.promotion_rules (school_id);

COMMENT ON TABLE public.promotion_rules IS
  'Minimum average exam grade (%) for promotion. class_id NULL = school default.';

COMMENT ON COLUMN public.promotion_rules.min_average_grade IS
  'Minimum average exam score percentage required to promote (e.g. 50 = 50%).';

DROP TRIGGER IF EXISTS promotion_rules_updated_at ON public.promotion_rules;
CREATE TRIGGER promotion_rules_updated_at
  BEFORE UPDATE ON public.promotion_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- classes: opt-in to class-specific rule
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS use_promotion_rules boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.classes.use_promotion_rules IS
  'When true, this class uses its own promotion_rules row instead of the school default.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.promotion_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promotion_rules_select ON public.promotion_rules;
CREATE POLICY promotion_rules_select
  ON public.promotion_rules FOR SELECT
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS promotion_rules_insert ON public.promotion_rules;
CREATE POLICY promotion_rules_insert
  ON public.promotion_rules FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS promotion_rules_update ON public.promotion_rules;
CREATE POLICY promotion_rules_update
  ON public.promotion_rules FOR UPDATE
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS promotion_rules_delete ON public.promotion_rules;
CREATE POLICY promotion_rules_delete
  ON public.promotion_rules FOR DELETE
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_rules TO authenticated;
GRANT ALL ON public.promotion_rules TO service_role;
