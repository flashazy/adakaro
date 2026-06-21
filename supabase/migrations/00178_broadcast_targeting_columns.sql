-- Broadcast targeting metadata: audience scope, schools, and Smart Intelligence source.

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'all';

ALTER TABLE public.broadcasts
  DROP CONSTRAINT IF EXISTS broadcasts_target_type_check;

ALTER TABLE public.broadcasts
  ADD CONSTRAINT broadcasts_target_type_check
  CHECK (target_type IN ('all', 'single_school', 'selected_schools', 'targeted_admins'));

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS target_school_id uuid NULL
  REFERENCES public.schools (id) ON DELETE SET NULL;

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS target_school_ids uuid[] NULL;

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS source text NULL;

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS source_context jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.broadcasts.target_type IS
  'Audience scope: all, single_school, selected_schools, or targeted_admins.';

COMMENT ON COLUMN public.broadcasts.target_school_id IS
  'When target_type = single_school, the school this broadcast targets.';

COMMENT ON COLUMN public.broadcasts.target_school_ids IS
  'When target_type = selected_schools, schools included in the audience.';

COMMENT ON COLUMN public.broadcasts.source IS
  'Optional origin label (e.g. churn, onboarding) for Smart Intelligence follow-ups.';

COMMENT ON COLUMN public.broadcasts.source_context IS
  'Optional JSON metadata for follow-up context (school name, risk level, etc.).';

-- Backfill legacy targeted broadcasts that already store target_user_ids.
UPDATE public.broadcasts
SET target_type = 'targeted_admins'
WHERE target_type = 'all'
  AND target_user_ids IS NOT NULL
  AND cardinality(target_user_ids) > 0;

CREATE INDEX IF NOT EXISTS idx_broadcasts_target_type
  ON public.broadcasts (target_type);

CREATE INDEX IF NOT EXISTS idx_broadcasts_target_school_id
  ON public.broadcasts (target_school_id)
  WHERE target_school_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcasts_target_school_ids
  ON public.broadcasts USING GIN (target_school_ids);
