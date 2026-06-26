-- Zero-cost self-learning: capture events + admin-approved suggestions

CREATE TABLE IF NOT EXISTS public.ai_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_question text NOT NULL,
  normalized_question text NOT NULL,
  source text NOT NULL DEFAULT 'public_ai'
    CHECK (source IN ('public_ai', 'copilot', 'whatsapp', 'website', 'demo', 'support', 'other')),
  matched_entry_id uuid REFERENCES public.ai_knowledge_entries (id) ON DELETE SET NULL,
  matched_intent_key text,
  final_score numeric(5, 4),
  confidence_level text NOT NULL DEFAULT 'low'
    CHECK (confidence_level IN ('high', 'medium', 'low')),
  answer_status text NOT NULL
    CHECK (answer_status IN ('answered', 'clarified', 'unanswered', 'fallback', 'llm')),
  top_candidate_entries jsonb NOT NULL DEFAULT '[]',
  top_candidate_intents jsonb NOT NULL DEFAULT '[]',
  reason_signals jsonb NOT NULL DEFAULT '[]',
  page_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_learning_events_created_idx
  ON public.ai_learning_events (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_learning_events_normalized_idx
  ON public.ai_learning_events (normalized_question);

CREATE INDEX IF NOT EXISTS ai_learning_events_intent_idx
  ON public.ai_learning_events (matched_intent_key)
  WHERE matched_intent_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_learning_events_status_idx
  ON public.ai_learning_events (answer_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_learning_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_type text NOT NULL
    CHECK (suggestion_type IN (
      'search_phrase',
      'alternative_wording',
      'synonym',
      'keyword',
      'related_intent',
      'new_entry',
      'intent_trigger',
      'intent_negative'
    )),
  suggested_text text NOT NULL,
  target_entry_id uuid REFERENCES public.ai_knowledge_entries (id) ON DELETE SET NULL,
  target_intent_key text,
  source_questions text[] NOT NULL DEFAULT '{}',
  source_event_ids uuid[] NOT NULL DEFAULT '{}',
  occurrence_count integer NOT NULL DEFAULT 1,
  confidence numeric(5, 4) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  cluster_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_learning_suggestions_pending_dedup_idx
  ON public.ai_learning_suggestions (cluster_key)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ai_learning_suggestions_status_idx
  ON public.ai_learning_suggestions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_intent_learning_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_key text NOT NULL UNIQUE,
  trigger_phrases text[] NOT NULL DEFAULT '{}',
  negative_phrases text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS ai_learning_suggestions_updated_at ON public.ai_learning_suggestions;
CREATE TRIGGER ai_learning_suggestions_updated_at
  BEFORE UPDATE ON public.ai_learning_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS ai_intent_learning_overrides_updated_at ON public.ai_intent_learning_overrides;
CREATE TRIGGER ai_intent_learning_overrides_updated_at
  BEFORE UPDATE ON public.ai_intent_learning_overrides
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.ai_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_intent_learning_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_learning_events_super_admin_all ON public.ai_learning_events;
CREATE POLICY ai_learning_events_super_admin_all
  ON public.ai_learning_events FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS ai_learning_suggestions_super_admin_all ON public.ai_learning_suggestions;
CREATE POLICY ai_learning_suggestions_super_admin_all
  ON public.ai_learning_suggestions FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS ai_intent_learning_overrides_super_admin_all ON public.ai_intent_learning_overrides;
CREATE POLICY ai_intent_learning_overrides_super_admin_all
  ON public.ai_intent_learning_overrides FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_learning_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_learning_suggestions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_intent_learning_overrides TO authenticated;

GRANT ALL ON TABLE public.ai_learning_events TO service_role;
GRANT ALL ON TABLE public.ai_learning_suggestions TO service_role;
GRANT ALL ON TABLE public.ai_intent_learning_overrides TO service_role;
