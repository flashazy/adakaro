-- Persistent per-parent "seen state" for attention indicators.
-- Used across mobile + future web to hide indicators until newer updates arrive.

CREATE TABLE IF NOT EXISTS public.parent_seen_states (
  parent_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_messages_at timestamptz,
  last_seen_subject_results_at timestamptz,
  last_seen_report_cards_at timestamptz,
  last_seen_receipts_at timestamptz,
  last_seen_fees_at timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'parent_seen_states_updated_at'
  ) THEN
    CREATE TRIGGER parent_seen_states_updated_at
      BEFORE UPDATE ON public.parent_seen_states
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

ALTER TABLE public.parent_seen_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_seen_states_select_own"
  ON public.parent_seen_states FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "parent_seen_states_insert_own"
  ON public.parent_seen_states FOR INSERT
  WITH CHECK (parent_id = auth.uid());

CREATE POLICY "parent_seen_states_update_own"
  ON public.parent_seen_states FOR UPDATE
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.parent_seen_states TO authenticated;

