-- Phase 1: Student promotion (year-end class progression)

DO $$ BEGIN
  CREATE TYPE public.student_promotion_decision AS ENUM (
    'promote',
    'repeat',
    'graduate'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- class_progression_tracks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_progression_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  track_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, track_name)
);

CREATE INDEX IF NOT EXISTS idx_class_progression_tracks_school
  ON public.class_progression_tracks (school_id);

COMMENT ON TABLE public.class_progression_tracks IS
  'Progression pathway per school (e.g. Primary, Secondary, A-Level).';

DROP TRIGGER IF EXISTS class_progression_tracks_updated_at ON public.class_progression_tracks;
CREATE TRIGGER class_progression_tracks_updated_at
  BEFORE UPDATE ON public.class_progression_tracks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- classes: track + order in sequence
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS track_id uuid REFERENCES public.class_progression_tracks(id) ON DELETE SET NULL;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS progression_order integer;

CREATE INDEX IF NOT EXISTS idx_classes_track_order
  ON public.classes (school_id, track_id, progression_order)
  WHERE track_id IS NOT NULL;

COMMENT ON COLUMN public.classes.track_id IS
  'Progression track this class belongs to (Primary, Secondary, etc.).';
COMMENT ON COLUMN public.classes.progression_order IS
  'Sort order within track; next class has order + 1 on the same track.';

-- ---------------------------------------------------------------------------
-- student_promotions (audit log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  to_class_id uuid REFERENCES public.classes(id) ON DELETE RESTRICT,
  decision public.student_promotion_decision NOT NULL,
  academic_year integer NOT NULL,
  promoted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  promoted_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  admin_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_promotions_school_year
  ON public.student_promotions (school_id, academic_year DESC);

CREATE INDEX IF NOT EXISTS idx_student_promotions_student
  ON public.student_promotions (student_id, promoted_at DESC);

COMMENT ON TABLE public.student_promotions IS
  'Audit log when admins promote, repeat, or graduate students at year-end.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.class_progression_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_progression_tracks_select ON public.class_progression_tracks;
CREATE POLICY class_progression_tracks_select
  ON public.class_progression_tracks FOR SELECT
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS class_progression_tracks_insert ON public.class_progression_tracks;
CREATE POLICY class_progression_tracks_insert
  ON public.class_progression_tracks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS class_progression_tracks_update ON public.class_progression_tracks;
CREATE POLICY class_progression_tracks_update
  ON public.class_progression_tracks FOR UPDATE
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS class_progression_tracks_delete ON public.class_progression_tracks;
CREATE POLICY class_progression_tracks_delete
  ON public.class_progression_tracks FOR DELETE
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS student_promotions_select ON public.student_promotions;
CREATE POLICY student_promotions_select
  ON public.student_promotions FOR SELECT
  TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS student_promotions_insert ON public.student_promotions;
CREATE POLICY student_promotions_insert
  ON public.student_promotions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_progression_tracks TO authenticated;
GRANT SELECT, INSERT ON public.student_promotions TO authenticated;
GRANT ALL ON public.class_progression_tracks TO service_role;
GRANT ALL ON public.student_promotions TO service_role;
