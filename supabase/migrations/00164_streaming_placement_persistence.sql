-- Student streaming: persist class moves and enrich history audit fields.

-- service_role must update students.class_id when coordinators apply placements.
GRANT UPDATE ON TABLE public.students TO service_role;

ALTER TABLE public.student_streaming_history
  ADD COLUMN IF NOT EXISTS recommended_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recommended_class_name text,
  ADD COLUMN IF NOT EXISTS placement_target_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placement_target_class_name text,
  ADD COLUMN IF NOT EXISTS is_manual_change boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.student_streaming_history.recommended_class_id IS
  'Stream recommended by exam result and streaming rules at placement time.';
COMMENT ON COLUMN public.student_streaming_history.placement_target_class_id IS
  'Stream the coordinator selected as the placement target (usually equals new_class_id).';
COMMENT ON COLUMN public.student_streaming_history.is_manual_change IS
  'True when placement target differed from the rule-based recommendation.';
